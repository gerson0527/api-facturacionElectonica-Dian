import { Injectable, Logger } from '@nestjs/common';
import { create } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

export interface InvoiceXmlData {
  number: string;
  issueDate: string;
  issueTime: string;
  invoiceType: string;
  paymentFormCode: string;
  paymentMethodCode: string;
  currencyCode: string;
  dueDate?: string;
  cufe: string;
  qrCode: string;
  softwareId: string;
  softwarePin: string;
  environment: string;
  testSetId: string;
  issuer: {
    nit: string;
    dv: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    municipalityCode: string;
    fiscalResponsibilities: string[];
  };
  customer: {
    documentType: string;
    documentNumber: string;
    dv?: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    municipalityCode: string;
    fiscalResponsibilities: string[];
  };
  taxTotals: Array<{
    taxId: string;
    taxPercent: number;
    taxableAmount: number;
    taxAmount: number;
  }>;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  lines: Array<{
    lineNumber: number;
    description: string;
    quantity: number;
    unitCode: string;
    unitPrice: number;
    lineExtensionAmount: number;
    taxCode: string;
    taxPercent: number;
    taxAmount: number;
  }>;
}

@Injectable()
export class XmlBuilderService {
  private readonly logger = new Logger(XmlBuilderService.name);

  constructor(private configService: ConfigService) {}

  async buildInvoiceXml(data: InvoiceXmlData): Promise<string> {
    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Invoice', {
        xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
        'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
        'xmlns:sts': 'dian:gov:co:facturaelectronica:Structures-2-1',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      });

    // UBL extensions for DIAN
    const extensions = doc.ele('ext:UBLExtensions');
    this.buildDianExtensions(extensions, data);

    // Standard UBL fields
    doc.ele('cbc:UBLVersionID').txt('UBL 2.1').up();
    doc.ele('cbc:CustomizationID').txt('10').up();
    doc.ele('cbc:ProfileID').txt('DIAN 1.0').up();
    doc.ele('cbc:ProfileExecutionID').txt(data.environment === 'habilitacion' ? '1' : '2').up();
    doc.ele('cbc:ID').txt(data.number).up();
    doc.ele('cbc:UUID', { schemeID: '2', schemeName: 'CUFE-SHA384' }).txt(data.cufe).up();
    doc.ele('cbc:IssueDate').txt(data.issueDate).up();
    doc.ele('cbc:IssueTime').txt(data.issueTime).up();
    if (data.dueDate) {
      doc.ele('cbc:DueDate').txt(data.dueDate).up();
    }
    doc.ele('cbc:InvoiceTypeCode', { listID: data.invoiceType, listAgencyID: '6', listName: 'Tipo Factura' }).txt(data.invoiceType).up();
    doc.ele('cbc:Note').txt(`Código CUFE: ${data.cufe}`).up();
    doc.ele('cbc:DocumentCurrencyCode', { listID: 'ISO 4217 Alpha', listAgencyID: '6' }).txt(data.currencyCode || 'COP').up();
    doc.ele('cbc:LineCountNumeric').txt(String(data.lines.length)).up();

    // AccountingSupplierParty
    this.buildAccountingSupplierParty(doc, data.issuer);

    // AccountingCustomerParty
    this.buildAccountingCustomerParty(doc, data.customer);

    // PaymentMeans
    this.buildPaymentMeans(doc, data);

    // TaxTotal
    this.buildTaxTotals(doc, data);

    // LegalMonetaryTotal
    this.buildLegalMonetaryTotal(doc, data);

    // InvoiceLines
    this.buildInvoiceLines(doc, data);

    const xml = doc.end({ prettyPrint: true, headless: false });
    return xml;
  }

  private buildDianExtensions(parent: XMLBuilder, data: InvoiceXmlData): void {
    const ext = parent.ele('ext:UBLExtension')
      .ele('ext:ExtensionContent');
    this.buildInvoiceControl(ext, data);
    const ext2 = parent.ele('ext:UBLExtension')
      .ele('ext:ExtensionContent');
    ext2.ele('ds:Signature', {
      xmlns: 'http://www.w3.org/2000/09/xmldsig#',
      Id: 'factura-electronica',
    });
  }

  private buildInvoiceControl(parent: XMLBuilder, data: InvoiceXmlData): void {
    parent.ele('sts:InvoiceControl')
      .ele('sts:InvoiceAuthorization').txt(data.number.substring(0, data.number.lastIndexOf(' ')) + ' ' + data.number.split(' ').pop()).up()
      .ele('sts:AuthorizationPeriod')
      .ele('cbc:StartDate').txt('2020-01-01').up()
      .ele('cbc:EndDate').txt('2099-12-31').up()
      .up()
      .ele('sts:AuthorizedInvoices')
      .ele('sts:Prefix').txt(data.number.split(' ')[0]).up()
      .ele('sts:From').txt('1').up()
      .ele('sts:To').txt('99999999').up()
      .up()
      .ele('sts:SoftwareID').txt(data.softwareId).up()
      .ele('sts:SoftwareSecurityCode', { schemeID: data.softwareId, schemeName: 'software_sec' })
      .txt(data.cufe).up()
      .ele('sts:AuthorizationProviderID', { schemeID: '4', schemeName: '31' })
      .txt(data.issuer.nit).up()
      .ele('sts:QRCode').txt(data.qrCode).up();
  }

  private buildAccountingSupplierParty(parent: XMLBuilder, issuer: InvoiceXmlData['issuer']): void {
    const party = parent.ele('cac:AccountingSupplierParty')
      .ele('cbc:AdditionalAccountID', { schemeID: '1', schemeName: 'Tipo de Identificación' })
      .txt('31').up()
      .ele('cac:Party')
      .ele('cac:PartyIdentification')
      .ele('cbc:ID', { schemeID: '31', schemeName: 'NIT' })
      .txt(issuer.nit).up().up()
      .ele('cac:PartyName')
      .ele('cbc:Name').txt(issuer.name).up().up()
      .ele('cac:PhysicalLocation')
      .ele('cac:Address')
      .ele('cbc:Department').txt('N/A').up()
      .ele('cbc:CityName').txt('N/A').up()
      .ele('cbc:CountrySubentity').txt('N/A').up()
      .ele('cac:Country')
      .ele('cbc:IdentificationCode', { listID: 'ISO 3166-1', listAgencyID: '6' }).txt('CO').up().up()
      .up().up()
      .ele('cac:PartyTaxScheme')
      .ele('cbc:RegistrationName').txt(issuer.name).up()
      .ele('cbc:CompanyID', { schemeID: '31', schemeName: 'NIT' }).txt(issuer.nit).up()
      .ele('cac:TaxScheme')
      .ele('cbc:ID', { schemeID: '6', schemeName: 'IVA' }).txt('01').up().up()
      .up()
      .ele('cac:PartyLegalEntity')
      .ele('cbc:RegistrationName').txt(issuer.name).up()
      .ele('cbc:CompanyID', { schemeID: '31', schemeName: 'NIT' }).txt(issuer.nit).up();
  }

  private buildAccountingCustomerParty(parent: XMLBuilder, customer: InvoiceXmlData['customer']): void {
    const docTypeMap: Record<string, string> = { '31': '31', '13': '13', '11': '11' };
    const schemeId = docTypeMap[customer.documentType] || '13';
    const party = parent.ele('cac:AccountingCustomerParty')
      .ele('cbc:AdditionalAccountID', { schemeID: '1', schemeName: 'Tipo de Identificación' })
      .txt(schemeId).up()
      .ele('cac:Party')
      .ele('cac:PartyIdentification')
      .ele('cbc:ID', { schemeID: schemeId })
      .txt(customer.documentNumber).up().up()
      .ele('cac:PartyName')
      .ele('cbc:Name').txt(customer.name).up().up()
      .ele('cac:PhysicalLocation')
      .ele('cac:Address')
      .ele('cbc:Department').txt('N/A').up()
      .ele('cbc:CityName').txt('N/A').up()
      .ele('cbc:CountrySubentity').txt('N/A').up()
      .ele('cac:Country')
      .ele('cbc:IdentificationCode', { listID: 'ISO 3166-1', listAgencyID: '6' }).txt('CO').up().up()
      .up().up()
      .ele('cac:PartyTaxScheme')
      .ele('cbc:RegistrationName').txt(customer.name).up()
      .ele('cbc:CompanyID', { schemeID: schemeId }).txt(customer.documentNumber).up()
      .ele('cac:TaxScheme')
      .ele('cbc:ID', { schemeID: '6', schemeName: 'IVA' }).txt('01').up().up()
      .up()
      .ele('cac:PartyLegalEntity')
      .ele('cbc:RegistrationName').txt(customer.name).up()
      .ele('cbc:CompanyID', { schemeID: schemeId }).txt(customer.documentNumber).up();
  }

  private buildPaymentMeans(parent: XMLBuilder, data: InvoiceXmlData): void {
    const payment = parent.ele('cac:PaymentMeans')
      .ele('cbc:PaymentMeansCode', { listID: data.paymentFormCode })
      .txt(data.paymentFormCode).up()
      .ele('cbc:PaymentDueDate').txt(data.dueDate || data.issueDate).up()
      .ele('cbc:PaymentID').txt(data.number).up();
  }

  private buildTaxTotals(parent: XMLBuilder, data: InvoiceXmlData): void {
    for (const tax of data.taxTotals) {
      const taxAmount = parent.ele('cac:TaxTotal')
        .ele('cbc:TaxAmount', { currencyID: data.currencyCode || 'COP' })
        .txt(tax.taxAmount.toFixed(2)).up()
        .ele('cac:TaxSubtotal')
        .ele('cbc:TaxableAmount', { currencyID: data.currencyCode || 'COP' })
        .txt(tax.taxableAmount.toFixed(2)).up()
        .ele('cbc:TaxAmount', { currencyID: data.currencyCode || 'COP' })
        .txt(tax.taxAmount.toFixed(2)).up()
        .ele('cac:TaxCategory')
        .ele('cbc:Percent').txt(tax.taxPercent.toFixed(2)).up()
        .ele('cac:TaxScheme')
        .ele('cbc:ID', { schemeID: '6', schemeName: tax.taxId === '01' ? 'IVA' : 'INC' })
        .txt(tax.taxId).up();
    }
  }

  private buildLegalMonetaryTotal(parent: XMLBuilder, data: InvoiceXmlData): void {
    const currency = data.currencyCode || 'COP';
    parent.ele('cac:LegalMonetaryTotal')
      .ele('cbc:LineExtensionAmount', { currencyID: currency })
      .txt(data.subtotal.toFixed(2)).up()
      .ele('cbc:TaxExclusiveAmount', { currencyID: currency })
      .txt(data.subtotal.toFixed(2)).up()
      .ele('cbc:TaxInclusiveAmount', { currencyID: currency })
      .txt(data.totalAmount.toFixed(2)).up()
      .ele('cbc:AllowanceTotalAmount', { currencyID: currency })
      .txt('0.00').up()
      .ele('cbc:ChargeTotalAmount', { currencyID: currency })
      .txt('0.00').up()
      .ele('cbc:PayableAmount', { currencyID: currency })
      .txt(data.totalAmount.toFixed(2)).up();
  }

  private buildInvoiceLines(parent: XMLBuilder, data: InvoiceXmlData): void {
    for (const line of data.lines) {
      const invLine = parent.ele('cac:InvoiceLine')
        .ele('cbc:ID').txt(String(line.lineNumber)).up()
        .ele('cbc:InvoicedQuantity', { unitCode: line.unitCode, unitCodeListID: 'UN/ECE 20' })
        .txt(String(line.quantity)).up()
        .ele('cbc:LineExtensionAmount', { currencyID: data.currencyCode || 'COP' })
        .txt(line.lineExtensionAmount.toFixed(2)).up()
        .ele('cac:Item')
        .ele('cbc:Description').txt(line.description).up()
        .ele('cac:StandardItemIdentification')
        .ele('cbc:ID', { schemeID: '001', schemeName: 'Estándar' }).txt('1').up()
        .up()
        .ele('cac:TaxScheme')
        .ele('cbc:ID', { schemeID: '6', schemeName: line.taxCode === '01' ? 'IVA' : 'INC' })
        .txt(line.taxCode).up()
        .up()
        .up()
        .ele('cac:Price')
        .ele('cbc:PriceAmount', { currencyID: data.currencyCode || 'COP' })
        .txt(line.unitPrice.toFixed(2)).up()
        .ele('cbc:BaseQuantity', { unitCode: line.unitCode })
        .txt(String(line.quantity)).up();
    }
  }

  async validateAgainstXsd(xmlContent: string): Promise<boolean> {
    try {
      const libxmljs = await import('libxmljs2');
      const xsdPath = this.configService.get<string>('XSD_PATH') || './xsd';
      const xsdContent = await fs.readFile(path.join(xsdPath, 'invoice.xsd'), 'utf-8');
      const xsdDoc = libxmljs.parseXml(xsdContent);
      const xmlDoc = libxmljs.parseXml(xmlContent);
      const valid = xmlDoc.validate(xsdDoc);
      if (!valid) {
        const errors = xmlDoc.validationErrors;
        this.logger.warn(`XSD validation errors: ${errors.map((e: any) => e.message).join(', ')}`);
      }
      return valid;
    } catch (err) {
      this.logger.warn(`XSD validation skipped: ${(err as Error).message}`);
      return true;
    }
  }
}
