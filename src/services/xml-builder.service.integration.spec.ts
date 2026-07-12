import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { XmlBuilderService, InvoiceXmlData } from './xml-builder.service';
import { CufeService } from './cufe.service';

describe('XmlBuilderService - Integration', () => {
  let xmlService: XmlBuilderService;
  let cufeService: CufeService;

  function buildSampleData(): InvoiceXmlData {
    const cufe = cufeService.generate({
      numFac: 'SETP990000000001',
      fecFac: '2024-06-15',
      horFac: '14:30:00',
      valBruto: '1000000.00',
      valIva: '190000.00',
      valAdicional: '0.00',
      valTotal: '1190000.00',
      nitEmisor: '900123456',
      dvEmisor: '0',
      tipoDocAdquirente: '13',
      numDocAdquirente: '123456789',
      dvAdquirente: '',
      softwarePin: 'SE3F5G8H2K7M4N9P',
      ambiente: '1',
    });

    return {
      number: 'SETP990000000001',
      issueDate: '2024-06-15',
      issueTime: '14:30:00',
      invoiceType: '01',
      paymentFormCode: '1',
      paymentMethodCode: '10',
      currencyCode: 'COP',
      cufe,
      qrCode: `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufe}`,
      softwareId: '7a8b9c0d1e2f3a4b5c6d7e8f',
      softwarePin: 'SE3F5G8H2K7M4N9P',
      environment: 'habilitacion',
      testSetId: 'test-set-001',
      issuer: {
        nit: '900123456',
        dv: '0',
        name: 'EMPRESA DE PRUEBA SAS',
        address: 'Cra 50 # 20-30',
        phone: '6012345678',
        email: 'contabilidad@empresa.com',
        municipalityCode: '11001',
        fiscalResponsibilities: ['O-99'],
      },
      customer: {
        documentType: '13',
        documentNumber: '123456789',
        dv: '0',
        name: 'CLIENTE DE PRUEBA',
        address: 'Cll 10 # 5-20',
        phone: '3009876543',
        email: 'cliente@test.com',
        municipalityCode: '11001',
        fiscalResponsibilities: ['O-99'],
      },
      taxTotals: [{ taxId: '01', taxPercent: 19, taxableAmount: 1000000, taxAmount: 190000 }],
      subtotal: 1000000,
      totalTax: 190000,
      totalAmount: 1190000,
      lines: [
        {
          lineNumber: 1,
          description: 'Servicio de consultoría',
          quantity: 1,
          unitCode: '94',
          unitPrice: 1000000,
          lineExtensionAmount: 1000000,
          taxCode: '01',
          taxPercent: 19,
          taxAmount: 190000,
        },
      ],
    };
  }

  beforeEach(async () => {
    cufeService = new CufeService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XmlBuilderService,
        { provide: ConfigService, useValue: { get: () => './xsd' } },
      ],
    }).compile();
    xmlService = module.get<XmlBuilderService>(XmlBuilderService);
  });

  it('debe generar XML con todos los elementos UBL 2.1 requeridos', async () => {
    const xml = await xmlService.buildInvoiceXml(buildSampleData());

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
    expect(xml).toContain('ext:UBLExtensions');
    expect(xml).toContain('UBLVersionID');
    expect(xml).toContain('ProfileID');
    expect(xml).toContain('cbc:InvoiceTypeCode');
    expect(xml).toContain('cbc:DocumentCurrencyCode');
  });

  it('debe incluir CUFE y QR en el XML', async () => {
    const data = buildSampleData();
    const xml = await xmlService.buildInvoiceXml(data);

    expect(xml).toContain(data.cufe);
    expect(xml).toContain(data.qrCode);
    expect(xml).toContain('CUFE-SHA384');
  });

  it('debe incluir datos del emisor y adquirente', async () => {
    const data = buildSampleData();
    const xml = await xmlService.buildInvoiceXml(data);

    expect(xml).toContain('AccountingSupplierParty');
    expect(xml).toContain('AccountingCustomerParty');
    expect(xml).toContain(data.issuer.nit);
    expect(xml).toContain(data.issuer.name);
    expect(xml).toContain(data.customer.documentNumber);
    expect(xml).toContain(data.customer.name);
  });

  it('debe incluir totales y líneas de factura', async () => {
    const data = buildSampleData();
    const xml = await xmlService.buildInvoiceXml(data);

    expect(xml).toContain('LegalMonetaryTotal');
    expect(xml).toContain('TaxTotal');
    expect(xml).toContain('InvoiceLine');
    expect(xml).toContain(data.subtotal.toFixed(2));
    expect(xml).toContain(data.totalAmount.toFixed(2));
    expect(xml).toContain(data.lines[0].description);
  });

  it('debe generar XML con firma XAdES-EPES (placeholder ds:Signature)', async () => {
    const xml = await xmlService.buildInvoiceXml(buildSampleData());

    expect(xml).toContain('ds:Signature');
    expect(xml).toContain('factura-electronica');
  });

  it('debe incluir InvoiceControl con software ID y código de seguridad', async () => {
    const data = buildSampleData();
    const xml = await xmlService.buildInvoiceXml(data);

    expect(xml).toContain('InvoiceControl');
    expect(xml).toContain(data.softwareId);
    expect(xml).toContain('SoftwareSecurityCode');
  });
});
