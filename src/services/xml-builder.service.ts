import { Injectable, Logger } from "@nestjs/common";
import { create } from "xmlbuilder2";
import { XMLBuilder } from "xmlbuilder2/lib/interfaces";
import * as fs from "fs/promises";
import * as path from "path";
import { ConfigService } from "@nestjs/config";

export interface PartyXmlData {
  nit: string;
  dv: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  municipalityCode: string;
  fiscalResponsibilities: string[];
}

export interface TaxTotalXmlData {
  taxId: string;
  taxPercent: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface LineXmlData {
  lineNumber: number;
  description: string;
  quantity: number;
  unitCode: string;
  unitPrice: number;
  lineExtensionAmount: number;
  taxCode: string;
  taxPercent: number;
  taxAmount: number;
}

export interface DocumentXmlData {
  number: string;
  issueDate: string;
  issueTime: string;
  currencyCode: string;
  cufe: string;
  qrCode: string;
  softwareId: string;
  softwarePin: string;
  environment: string;
  testSetId: string;
  issuer: PartyXmlData;
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
  taxTotals: TaxTotalXmlData[];
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  lines: LineXmlData[];
}

export interface InvoiceXmlData extends DocumentXmlData {
  invoiceType: string;
  paymentFormCode: string;
  paymentMethodCode: string;
  dueDate?: string;
}

export interface CreditNoteXmlData extends DocumentXmlData {
  noteType: string;
  invoiceId: string;
  invoiceNumber: string;
  reasonCode: string;
  description?: string;
}

export interface DebitNoteXmlData extends DocumentXmlData {
  noteType: string;
  invoiceId: string;
  invoiceNumber: string;
  reasonCode: string;
  description?: string;
}

const PAYMENT_FORM_MAP: Record<string, string> = {
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
};

const DOC_TYPE_MAP: Record<string, string> = {
  "11": "11",
  "12": "12",
  "13": "13",
  "31": "31",
};

const TAX_NAME_MAP: Record<string, string> = {
  "01": "IVA",
  "02": "INC",
  "03": "ICA",
  "04": "ICUI",
  "05": "ReteIVA",
  "06": "ReteFuente",
  "07": "ReteICA",
  "08": "INPO",
};

@Injectable()
export class XmlBuilderService {
  private readonly logger = new Logger(XmlBuilderService.name);

  constructor(private configService: ConfigService) {}

  async buildInvoiceXml(data: InvoiceXmlData): Promise<string> {
    const doc = create({ version: "1.0", encoding: "UTF-8" }).ele("Invoice", {
      xmlns: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
      "xmlns:cac":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
      "xmlns:cbc":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
      "xmlns:ext":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
      "xmlns:sts": "dian:gov:co:facturaelectronica:Structures-2-1",
      "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "xsi:schemaLocation":
        "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2 http://docs.oasis-open.org/ubl/os-UBL-2.1/xsd/maindoc/UBL-Invoice-2.1.xsd",
    });

    const extensions = doc.ele("ext:UBLExtensions");
    this.buildDianExtensions(extensions, data);

    doc.ele("cbc:UBLVersionID").txt("UBL 2.1").up();
    doc.ele("cbc:CustomizationID").txt("10").up();
    doc.ele("cbc:ProfileID").txt("DIAN 1.0").up();
    doc
      .ele("cbc:ProfileExecutionID")
      .txt(data.environment === "habilitacion" ? "1" : "2")
      .up();
    doc.ele("cbc:ID").txt(data.number).up();
    doc
      .ele("cbc:UUID", { schemeID: "2", schemeName: "CUFE-SHA384" })
      .txt(data.cufe)
      .up();
    doc.ele("cbc:IssueDate").txt(data.issueDate).up();
    doc.ele("cbc:IssueTime").txt(data.issueTime).up();
    if (data.dueDate) {
      doc.ele("cbc:DueDate").txt(data.dueDate).up();
    }
    doc
      .ele("cbc:InvoiceTypeCode", {
        listID: "0101",
        listAgencyID: "6",
        listName: "Tipo Factura",
        listURI: "https://facturaelectronica.dian.gov.co/catalogo/tipofactura",
      })
      .txt(data.invoiceType)
      .up();
    doc
      .ele("cbc:Note", { languageLocaleID: "es-CO" })
      .txt(`Código CUFE: ${data.cufe}`)
      .up();
    doc
      .ele("cbc:DocumentCurrencyCode", {
        listID: "ISO 4217 Alpha",
        listAgencyID: "6",
        listName: "COP",
      })
      .txt(data.currencyCode || "COP")
      .up();
    doc.ele("cbc:LineCountNumeric").txt(String(data.lines.length)).up();

    this.buildAccountingSupplierParty(doc, data.issuer);
    this.buildAccountingCustomerParty(doc, data.customer);
    this.buildPaymentMeans(doc, data);
    this.buildTaxTotals(doc, data);
    this.buildLegalMonetaryTotal(doc, data);
    this.buildInvoiceLines(doc, data.lines, data.currencyCode);

    return doc.end({ prettyPrint: true, headless: false });
  }

  async buildCreditNoteXml(data: CreditNoteXmlData): Promise<string> {
    const doc = create({ version: "1.0", encoding: "UTF-8" }).ele(
      "CreditNote",
      {
        xmlns: "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2",
        "xmlns:cac":
          "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
        "xmlns:cbc":
          "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
        "xmlns:ext":
          "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
        "xmlns:sts": "dian:gov:co:facturaelectronica:Structures-2-1",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xsi:schemaLocation":
          "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2 http://docs.oasis-open.org/ubl/os-UBL-2.1/xsd/maindoc/UBL-CreditNote-2.1.xsd",
      },
    );

    const extensions = doc.ele("ext:UBLExtensions");
    this.buildDianExtensions(extensions, data);

    doc.ele("cbc:UBLVersionID").txt("UBL 2.1").up();
    doc.ele("cbc:CustomizationID").txt("10").up();
    doc.ele("cbc:ProfileID").txt("DIAN 1.0").up();
    doc
      .ele("cbc:ProfileExecutionID")
      .txt(data.environment === "habilitacion" ? "1" : "2")
      .up();
    doc.ele("cbc:ID").txt(data.number).up();
    doc
      .ele("cbc:UUID", { schemeID: "2", schemeName: "CUFE-SHA384" })
      .txt(data.cufe)
      .up();
    doc.ele("cbc:IssueDate").txt(data.issueDate).up();
    doc.ele("cbc:IssueTime").txt(data.issueTime).up();
    doc
      .ele("cbc:CreditNoteTypeCode", {
        listID: "0101",
        listAgencyID: "6",
        listName: "Tipo Nota Crédito",
        listURI:
          "https://facturaelectronica.dian.gov.co/catalogo/tiponotacredito",
      })
      .txt(data.noteType)
      .up();
    doc
      .ele("cbc:Note", { languageLocaleID: "es-CO" })
      .txt(
        `Código CUFE: ${data.cufe}${data.description ? ` - ${data.description}` : ""}`,
      )
      .up();
    doc
      .ele("cbc:DocumentCurrencyCode", {
        listID: "ISO 4217 Alpha",
        listAgencyID: "6",
        listName: "COP",
      })
      .txt(data.currencyCode || "COP")
      .up();
    doc.ele("cbc:LineCountNumeric").txt(String(data.lines.length)).up();

    doc
      .ele("cac:DiscrepancyResponse")
      .ele("cbc:ReferenceID")
      .txt(data.invoiceNumber)
      .up()
      .ele("cbc:ResponseCode")
      .txt(data.reasonCode)
      .up()
      .ele("cbc:Description")
      .txt(data.description || "Nota crédito")
      .up()
      .up();

    doc
      .ele("cac:BillingReference")
      .ele("cac:InvoiceDocumentReference")
      .ele("cbc:ID")
      .txt(data.invoiceNumber)
      .up()
      .ele("cbc:UUID", { schemeID: "2", schemeName: "CUFE-SHA384" })
      .txt(data.invoiceId)
      .up()
      .up()
      .up();

    this.buildAccountingSupplierParty(doc, data.issuer);
    this.buildAccountingCustomerParty(doc, data.customer);
    this.buildTaxTotals(doc, data);
    this.buildLegalMonetaryTotal(doc, data);
    this.buildCreditNoteLines(doc, data.lines, data.currencyCode);

    return doc.end({ prettyPrint: true, headless: false });
  }

  async buildDebitNoteXml(data: DebitNoteXmlData): Promise<string> {
    const doc = create({ version: "1.0", encoding: "UTF-8" }).ele("DebitNote", {
      xmlns: "urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2",
      "xmlns:cac":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
      "xmlns:cbc":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
      "xmlns:ext":
        "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
      "xmlns:sts": "dian:gov:co:facturaelectronica:Structures-2-1",
      "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "xsi:schemaLocation":
        "urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2 http://docs.oasis-open.org/ubl/os-UBL-2.1/xsd/maindoc/UBL-DebitNote-2.1.xsd",
    });

    const extensions = doc.ele("ext:UBLExtensions");
    this.buildDianExtensions(extensions, data);

    doc.ele("cbc:UBLVersionID").txt("UBL 2.1").up();
    doc.ele("cbc:CustomizationID").txt("10").up();
    doc.ele("cbc:ProfileID").txt("DIAN 1.0").up();
    doc
      .ele("cbc:ProfileExecutionID")
      .txt(data.environment === "habilitacion" ? "1" : "2")
      .up();
    doc.ele("cbc:ID").txt(data.number).up();
    doc
      .ele("cbc:UUID", { schemeID: "2", schemeName: "CUFE-SHA384" })
      .txt(data.cufe)
      .up();
    doc.ele("cbc:IssueDate").txt(data.issueDate).up();
    doc.ele("cbc:IssueTime").txt(data.issueTime).up();
    doc
      .ele("cbc:DebitNoteTypeCode", {
        listID: "0101",
        listAgencyID: "6",
        listName: "Tipo Nota Débito",
        listURI:
          "https://facturaelectronica.dian.gov.co/catalogo/tiponotadebito",
      })
      .txt(data.noteType)
      .up();
    doc
      .ele("cbc:Note", { languageLocaleID: "es-CO" })
      .txt(
        `Código CUFE: ${data.cufe}${data.description ? ` - ${data.description}` : ""}`,
      )
      .up();
    doc
      .ele("cbc:DocumentCurrencyCode", {
        listID: "ISO 4217 Alpha",
        listAgencyID: "6",
        listName: "COP",
      })
      .txt(data.currencyCode || "COP")
      .up();
    doc.ele("cbc:LineCountNumeric").txt(String(data.lines.length)).up();

    doc
      .ele("cac:DiscrepancyResponse")
      .ele("cbc:ReferenceID")
      .txt(data.invoiceNumber)
      .up()
      .ele("cbc:ResponseCode")
      .txt(data.reasonCode)
      .up()
      .ele("cbc:Description")
      .txt(data.description || "Nota débito")
      .up()
      .up();

    doc
      .ele("cac:BillingReference")
      .ele("cac:InvoiceDocumentReference")
      .ele("cbc:ID")
      .txt(data.invoiceNumber)
      .up()
      .ele("cbc:UUID", { schemeID: "2", schemeName: "CUFE-SHA384" })
      .txt(data.invoiceId)
      .up()
      .up()
      .up();

    this.buildAccountingSupplierParty(doc, data.issuer);
    this.buildAccountingCustomerParty(doc, data.customer);
    this.buildTaxTotals(doc, data);
    this.buildLegalMonetaryTotal(doc, data);
    this.buildDebitNoteLines(doc, data.lines, data.currencyCode);

    return doc.end({ prettyPrint: true, headless: false });
  }

  private buildDianExtensions(parent: XMLBuilder, data: DocumentXmlData): void {
    const ext = parent.ele("ext:UBLExtension").ele("ext:ExtensionContent");
    this.buildInvoiceControl(ext, data);
    const ext2 = parent.ele("ext:UBLExtension").ele("ext:ExtensionContent");
    ext2.ele("ds:Signature", {
      "xmlns:ds": "http://www.w3.org/2000/09/xmldsig#",
      Id: "factura-electronica",
    });
  }

  private buildInvoiceControl(parent: XMLBuilder, data: DocumentXmlData): void {
    const prefix = data.number.split(/\d/)[0];
    const authNumber = data.number;

    parent
      .ele("sts:InvoiceControl")
      .ele("sts:InvoiceAuthorization")
      .txt(authNumber)
      .up()
      .ele("sts:AuthorizationPeriod")
      .ele("cbc:StartDate")
      .txt("2020-01-01")
      .up()
      .ele("cbc:EndDate")
      .txt("2099-12-31")
      .up()
      .up()
      .ele("sts:AuthorizedInvoices")
      .ele("sts:Prefix")
      .txt(prefix || "")
      .up()
      .ele("sts:From")
      .txt("1")
      .up()
      .ele("sts:To")
      .txt("99999999")
      .up()
      .up()
      .ele("sts:SoftwareID")
      .txt(data.softwareId)
      .up()
      .ele("sts:SoftwareSecurityCode", {
        schemeID: data.softwareId,
        schemeName: "software_sec",
        schemeAgencyID: "195",
        schemeURI: "https://facturaelectronica.dian.gov.co/softwaresecurity",
      })
      .txt(data.cufe)
      .up()
      .ele("sts:AuthorizationProviderID", {
        schemeID: "4",
        schemeName: "31",
        schemeAgencyID: "195",
      })
      .txt(data.issuer.nit)
      .up()
      .ele("sts:QRCode")
      .txt(data.qrCode)
      .up();
  }

  private buildAccountingSupplierParty(
    parent: XMLBuilder,
    issuer: PartyXmlData,
  ): void {
    const schemeId = "31";
    parent
      .ele("cac:AccountingSupplierParty")
      .ele("cbc:AdditionalAccountID", {
        schemeID: "1",
        schemeName: "Tipo de Identificación",
        schemeAgencyID: "195",
      })
      .txt(schemeId)
      .up()
      .ele("cac:Party")
      .ele("cac:PartyIdentification")
      .ele("cbc:ID", {
        schemeID: schemeId,
        schemeName: "NIT",
        schemeAgencyID: "195",
      })
      .txt(issuer.nit)
      .up()
      .up()
      .ele("cac:PartyName")
      .ele("cbc:Name")
      .txt(issuer.name)
      .up()
      .up()
      .ele("cac:PhysicalLocation")
      .ele("cac:Address")
      .ele("cbc:ID")
      .txt(issuer.municipalityCode || "11001")
      .up()
      .ele("cbc:CityName")
      .txt("Bogotá D.C.")
      .up()
      .ele("cbc:CountrySubentity")
      .txt("Bogotá D.C.")
      .up()
      .ele("cbc:CountrySubentityCode")
      .txt(issuer.municipalityCode?.substring(0, 2) || "11")
      .up()
      .ele("cbc:Department")
      .txt("Cundinamarca")
      .up()
      .ele("cbc:PostalZone")
      .txt("110111")
      .up()
      .ele("cac:AddressLine")
      .ele("cbc:Line")
      .txt(issuer.address || "N/A")
      .up()
      .up()
      .ele("cac:Country")
      .ele("cbc:IdentificationCode", {
        listID: "ISO 3166-1",
        listAgencyID: "6",
        listName: "Colombia",
      })
      .txt("CO")
      .up()
      .up()
      .up()
      .up()
      .ele("cac:PartyTaxScheme")
      .ele("cbc:RegistrationName")
      .txt(issuer.name)
      .up()
      .ele("cbc:CompanyID", {
        schemeID: schemeId,
        schemeName: "NIT",
        schemeAgencyID: "195",
      })
      .txt(issuer.nit)
      .up()
      .ele("cac:TaxScheme")
      .ele("cbc:ID", {
        schemeID: "6",
        schemeName: "IVA",
        schemeAgencyID: "195",
      })
      .txt("01")
      .up()
      .up()
      .up()
      .ele("cac:PartyLegalEntity")
      .ele("cbc:RegistrationName")
      .txt(issuer.name)
      .up()
      .ele("cbc:CompanyID", {
        schemeID: schemeId,
        schemeName: "NIT",
        schemeAgencyID: "195",
      })
      .txt(issuer.nit)
      .up()
      .ele("cbc:CompanyLegalFormCode", {
        listID: "195",
        listAgencyID: "195",
        listName: "Tipo de Sociedad",
      })
      .txt("01")
      .up();
  }

  private buildAccountingCustomerParty(
    parent: XMLBuilder,
    customer: DocumentXmlData["customer"],
  ): void {
    const schemeId = DOC_TYPE_MAP[customer.documentType] || "13";
    parent
      .ele("cac:AccountingCustomerParty")
      .ele("cbc:AdditionalAccountID", {
        schemeID: "1",
        schemeName: "Tipo de Identificación",
        schemeAgencyID: "195",
      })
      .txt(schemeId)
      .up()
      .ele("cac:Party")
      .ele("cac:PartyIdentification")
      .ele("cbc:ID", {
        schemeID: schemeId,
        schemeName: "Documento de Identificación",
        schemeAgencyID: "195",
      })
      .txt(customer.documentNumber)
      .up()
      .up()
      .ele("cac:PartyName")
      .ele("cbc:Name")
      .txt(customer.name)
      .up()
      .up()
      .ele("cac:PhysicalLocation")
      .ele("cac:Address")
      .ele("cbc:ID")
      .txt(customer.municipalityCode || "11001")
      .up()
      .ele("cbc:CityName")
      .txt("Bogotá D.C.")
      .up()
      .ele("cbc:CountrySubentity")
      .txt("Bogotá D.C.")
      .up()
      .ele("cbc:CountrySubentityCode")
      .txt(customer.municipalityCode?.substring(0, 2) || "11")
      .up()
      .ele("cbc:Department")
      .txt("Cundinamarca")
      .up()
      .ele("cac:AddressLine")
      .ele("cbc:Line")
      .txt(customer.address || "N/A")
      .up()
      .up()
      .ele("cac:Country")
      .ele("cbc:IdentificationCode", {
        listID: "ISO 3166-1",
        listAgencyID: "6",
        listName: "Colombia",
      })
      .txt("CO")
      .up()
      .up()
      .up()
      .up()
      .ele("cac:PartyTaxScheme")
      .ele("cbc:RegistrationName")
      .txt(customer.name)
      .up()
      .ele("cbc:CompanyID", {
        schemeID: schemeId,
        schemeName: "Documento de Identificación",
        schemeAgencyID: "195",
      })
      .txt(customer.documentNumber)
      .up()
      .ele("cac:TaxScheme")
      .ele("cbc:ID", {
        schemeID: "6",
        schemeName: "IVA",
        schemeAgencyID: "195",
      })
      .txt("01")
      .up()
      .up()
      .up()
      .ele("cac:PartyLegalEntity")
      .ele("cbc:RegistrationName")
      .txt(customer.name)
      .up()
      .ele("cbc:CompanyID", {
        schemeID: schemeId,
        schemeName: "Documento de Identificación",
        schemeAgencyID: "195",
      })
      .txt(customer.documentNumber)
      .up()
      .ele("cbc:CompanyLegalFormCode", {
        listID: "195",
        listAgencyID: "195",
        listName: "Tipo de Persona",
      })
      .txt(customer.documentType === "31" ? "02" : "01")
      .up();
  }

  private buildPaymentMeans(
    parent: XMLBuilder,
    data: {
      paymentFormCode: string;
      dueDate?: string;
      issueDate: string;
      number: string;
    },
  ): void {
    parent
      .ele("cac:PaymentMeans")
      .ele("cbc:ID")
      .txt("1")
      .up()
      .ele("cbc:PaymentMeansCode", {
        listID: "DIAN-29",
        listAgencyID: "195",
        listName: "Forma de Pago",
        listURI: "https://facturaelectronica.dian.gov.co/catalogo/formaPago",
      })
      .txt(PAYMENT_FORM_MAP[data.paymentFormCode] || "1")
      .up()
      .ele("cbc:PaymentDueDate")
      .txt(data.dueDate || data.issueDate)
      .up()
      .ele("cbc:PaymentID")
      .txt(data.number)
      .up();
  }

  private buildTaxTotals(
    parent: XMLBuilder,
    data: { taxTotals: TaxTotalXmlData[]; currencyCode: string },
  ): void {
    for (const tax of data.taxTotals) {
      const currency = data.currencyCode || "COP";
      const taxName = TAX_NAME_MAP[tax.taxId] || "IVA";
      parent
        .ele("cac:TaxTotal")
        .ele("cbc:TaxAmount", {
          currencyID: currency,
        })
        .txt(tax.taxAmount.toFixed(2))
        .up()
        .ele("cac:TaxSubtotal")
        .ele("cbc:TaxableAmount", {
          currencyID: currency,
        })
        .txt(tax.taxableAmount.toFixed(2))
        .up()
        .ele("cbc:TaxAmount", {
          currencyID: currency,
        })
        .txt(tax.taxAmount.toFixed(2))
        .up()
        .ele("cac:TaxCategory")
        .ele("cbc:ID", {
          schemeID: "6",
          schemeName: taxName,
          schemeAgencyID: "195",
        })
        .txt(tax.taxId)
        .up()
        .ele("cbc:Percent")
        .txt(tax.taxPercent.toFixed(2))
        .up()
        .ele("cac:TaxScheme")
        .ele("cbc:ID", {
          schemeID: "6",
          schemeName: taxName,
          schemeAgencyID: "195",
        })
        .txt(tax.taxId)
        .up()
        .ele("cbc:Name")
        .txt(taxName)
        .up();
    }
  }

  private buildLegalMonetaryTotal(
    parent: XMLBuilder,
    data: { subtotal: number; totalAmount: number; currencyCode: string },
  ): void {
    const currency = data.currencyCode || "COP";
    parent
      .ele("cac:LegalMonetaryTotal")
      .ele("cbc:LineExtensionAmount", { currencyID: currency })
      .txt(data.subtotal.toFixed(2))
      .up()
      .ele("cbc:TaxExclusiveAmount", { currencyID: currency })
      .txt(data.subtotal.toFixed(2))
      .up()
      .ele("cbc:TaxInclusiveAmount", { currencyID: currency })
      .txt(data.totalAmount.toFixed(2))
      .up()
      .ele("cbc:AllowanceTotalAmount", { currencyID: currency })
      .txt("0.00")
      .up()
      .ele("cbc:ChargeTotalAmount", { currencyID: currency })
      .txt("0.00")
      .up()
      .ele("cbc:PrepaidAmount", { currencyID: currency })
      .txt("0.00")
      .up()
      .ele("cbc:PayableAmount", { currencyID: currency })
      .txt(data.totalAmount.toFixed(2))
      .up();
  }

  private buildInvoiceLines(
    parent: XMLBuilder,
    lines: LineXmlData[],
    currencyCode: string,
  ): void {
    for (const line of lines) {
      const currency = currencyCode || "COP";
      const taxName = TAX_NAME_MAP[line.taxCode] || "IVA";
      parent
        .ele("cac:InvoiceLine")
        .ele("cbc:ID")
        .txt(String(line.lineNumber))
        .up()
        .ele("cbc:InvoicedQuantity", {
          unitCode: line.unitCode,
          unitCodeListID: "UN/ECE 20",
          unitCodeListAgencyID: "6",
        })
        .txt(String(line.quantity))
        .up()
        .ele("cbc:LineExtensionAmount", { currencyID: currency })
        .txt(line.lineExtensionAmount.toFixed(2))
        .up()
        .ele("cac:Item")
        .ele("cbc:Description")
        .txt(line.description)
        .up()
        .ele("cac:StandardItemIdentification")
        .ele("cbc:ID", {
          schemeID: "001",
          schemeName: "Identificador del Producto",
          schemeAgencyID: "195",
        })
        .txt("1")
        .up()
        .up()
        .ele("cac:ItemTaxInformation")
        .ele("cbc:ID")
        .txt(taxName)
        .up()
        .ele("cbc:Percent")
        .txt(line.taxPercent.toFixed(2))
        .up()
        .ele("cac:TaxScheme")
        .ele("cbc:ID", {
          schemeID: "6",
          schemeName: taxName,
          schemeAgencyID: "195",
        })
        .txt(line.taxCode)
        .up()
        .ele("cbc:Name")
        .txt(taxName)
        .up()
        .up()
        .up()
        .ele("cac:Price")
        .ele("cbc:PriceAmount", { currencyID: currency })
        .txt(line.unitPrice.toFixed(2))
        .up()
        .ele("cbc:BaseQuantity", {
          unitCode: line.unitCode,
          unitCodeListID: "UN/ECE 20",
          unitCodeListAgencyID: "6",
        })
        .txt(String(line.quantity))
        .up();
    }
  }

  private buildCreditNoteLines(
    parent: XMLBuilder,
    lines: LineXmlData[],
    currencyCode: string,
  ): void {
    for (const line of lines) {
      const currency = currencyCode || "COP";
      const taxName = TAX_NAME_MAP[line.taxCode] || "IVA";
      parent
        .ele("cac:CreditNoteLine")
        .ele("cbc:ID")
        .txt(String(line.lineNumber))
        .up()
        .ele("cbc:CreditedQuantity", {
          unitCode: line.unitCode,
          unitCodeListID: "UN/ECE 20",
          unitCodeListAgencyID: "6",
        })
        .txt(String(line.quantity))
        .up()
        .ele("cbc:LineExtensionAmount", { currencyID: currency })
        .txt(line.lineExtensionAmount.toFixed(2))
        .up()
        .ele("cac:Item")
        .ele("cbc:Description")
        .txt(line.description)
        .up()
        .ele("cac:StandardItemIdentification")
        .ele("cbc:ID", {
          schemeID: "001",
          schemeName: "Identificador del Producto",
          schemeAgencyID: "195",
        })
        .txt("1")
        .up()
        .up()
        .ele("cac:ItemTaxInformation")
        .ele("cbc:ID")
        .txt(taxName)
        .up()
        .ele("cbc:Percent")
        .txt(line.taxPercent.toFixed(2))
        .up()
        .ele("cac:TaxScheme")
        .ele("cbc:ID", {
          schemeID: "6",
          schemeName: taxName,
          schemeAgencyID: "195",
        })
        .txt(line.taxCode)
        .up()
        .ele("cbc:Name")
        .txt(taxName)
        .up()
        .up()
        .up()
        .ele("cac:Price")
        .ele("cbc:PriceAmount", { currencyID: currency })
        .txt(line.unitPrice.toFixed(2))
        .up()
        .ele("cbc:BaseQuantity", {
          unitCode: line.unitCode,
          unitCodeListID: "UN/ECE 20",
          unitCodeListAgencyID: "6",
        })
        .txt(String(line.quantity))
        .up();
    }
  }

  private buildDebitNoteLines(
    parent: XMLBuilder,
    lines: LineXmlData[],
    currencyCode: string,
  ): void {
    for (const line of lines) {
      const currency = currencyCode || "COP";
      const taxName = TAX_NAME_MAP[line.taxCode] || "IVA";
      parent
        .ele("cac:DebitNoteLine")
        .ele("cbc:ID")
        .txt(String(line.lineNumber))
        .up()
        .ele("cbc:DebitedQuantity", {
          unitCode: line.unitCode,
          unitCodeListID: "UN/ECE 20",
          unitCodeListAgencyID: "6",
        })
        .txt(String(line.quantity))
        .up()
        .ele("cbc:LineExtensionAmount", { currencyID: currency })
        .txt(line.lineExtensionAmount.toFixed(2))
        .up()
        .ele("cac:Item")
        .ele("cbc:Description")
        .txt(line.description)
        .up()
        .ele("cac:StandardItemIdentification")
        .ele("cbc:ID", {
          schemeID: "001",
          schemeName: "Identificador del Producto",
          schemeAgencyID: "195",
        })
        .txt("1")
        .up()
        .up()
        .ele("cac:ItemTaxInformation")
        .ele("cbc:ID")
        .txt(taxName)
        .up()
        .ele("cbc:Percent")
        .txt(line.taxPercent.toFixed(2))
        .up()
        .ele("cac:TaxScheme")
        .ele("cbc:ID", {
          schemeID: "6",
          schemeName: taxName,
          schemeAgencyID: "195",
        })
        .txt(line.taxCode)
        .up()
        .ele("cbc:Name")
        .txt(taxName)
        .up()
        .up()
        .up()
        .ele("cac:Price")
        .ele("cbc:PriceAmount", { currencyID: currency })
        .txt(line.unitPrice.toFixed(2))
        .up()
        .ele("cbc:BaseQuantity", {
          unitCode: line.unitCode,
          unitCodeListID: "UN/ECE 20",
          unitCodeListAgencyID: "6",
        })
        .txt(String(line.quantity))
        .up();
    }
  }

  async validateAgainstXsd(xmlContent: string): Promise<boolean> {
    try {
      const libxmljs = await import("libxmljs2");
      const xsdPath = this.configService.get<string>("XSD_PATH") || "./xsd";
      const xsdContent = await fs.readFile(
        path.join(xsdPath, "invoice.xsd"),
        "utf-8",
      );
      const xsdDoc = libxmljs.parseXml(xsdContent);
      const xmlDoc = libxmljs.parseXml(xmlContent);
      const valid = xmlDoc.validate(xsdDoc);
      if (!valid) {
        const errors = xmlDoc.validationErrors;
        this.logger.error(
          `XSD validation errors: ${errors.map((e: any) => e.message).join("; ")}`,
        );
      }
      return valid;
    } catch (err) {
      this.logger.warn(`XSD validation skipped: ${(err as Error).message}`);
      return true;
    }
  }
}
