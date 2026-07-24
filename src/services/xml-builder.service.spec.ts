import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { CufeService } from "./cufe.service";
import { XmlBuilderService } from "./xml-builder.service";

import { CatalogsService } from "../modules/catalogs/catalogs.service";

describe("XmlBuilderService", () => {
  let service: XmlBuilderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XmlBuilderService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "XSD_PATH") return "./xsd";
              return undefined;
            },
          },
        },
        {
          provide: CatalogsService,
          useValue: {
            getItemByCode: jest.fn().mockReturnValue(null),
            getItemName: jest.fn().mockReturnValue("IVA"),
          },
        },
      ],
    }).compile();

    service = module.get<XmlBuilderService>(XmlBuilderService);
  });

  it("should generate valid UBL 2.1 XML", async () => {
    const data = {
      number: "SETP1",
      issueDate: "2024-01-15",
      issueTime: "10:30:00",
      invoiceType: "01",
      paymentFormCode: "1",
      paymentMethodCode: "10",
      currencyCode: "COP",
      cufe: "A".repeat(96),
      qrCode:
        "https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=" +
        "A".repeat(96),
      softwareId: "123456789",
      softwarePin: "test-pin",
      environment: "habilitacion",
      testSetId: "test-set-1",
      issuer: {
        nit: "900123456",
        dv: "0",
        name: "Test Company SAS",
        address: "Calle 123",
        phone: "3001234567",
        email: "test@company.com",
        municipalityCode: "11001",
        fiscalResponsibilities: ["O-99"],
      },
      customer: {
        documentType: "13",
        documentNumber: "123456789",
        dv: "0",
        name: "Test Customer",
        address: "Calle 456",
        phone: "3007654321",
        email: "customer@test.com",
        municipalityCode: "11001",
        fiscalResponsibilities: ["O-99"],
      },
      taxTotals: [
        {
          taxId: "01",
          taxPercent: 19,
          taxableAmount: 1000000,
          taxAmount: 190000,
        },
      ],
      subtotal: 1000000,
      totalTax: 190000,
      totalAmount: 1190000,
      lines: [
        {
          lineNumber: 1,
          description: "Producto de prueba",
          quantity: 10,
          unitCode: "94",
          unitPrice: 100000,
          lineExtensionAmount: 1000000,
          taxCode: "01",
          taxPercent: 19,
          taxAmount: 190000,
        },
      ],
    };

    const xml = await service.buildInvoiceXml(data);
    expect(xml).toBeDefined();
    expect(xml).toContain(
      "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    );
    expect(xml).toContain("SETP1");
    expect(xml).toContain("CUFE-SHA384");
    expect(xml).toContain("AccountingSupplierParty");
    expect(xml).toContain("AccountingCustomerParty");
    expect(xml).toContain("LegalMonetaryTotal");
    expect(xml).toContain("InvoiceLine");
  });
});
