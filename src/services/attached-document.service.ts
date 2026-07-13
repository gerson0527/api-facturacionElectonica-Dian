import { Injectable, Logger } from "@nestjs/common";
import { create } from "xmlbuilder2";
import { ConfigService } from "@nestjs/config";

export interface AttachedDocumentData {
  documentId: string;
  issueDate: string;
  issueTime: string;
  issuer: {
    nit: string;
    name: string;
  };
  customer: {
    documentType: string;
    documentNumber: string;
    name: string;
  };
  signedInvoiceXml: string;
  applicationResponseXml: string;
  cufe: string;
  invoiceType: string; // e.g. "01"
}

@Injectable()
export class AttachedDocumentService {
  private readonly logger = new Logger(AttachedDocumentService.name);

  constructor(private configService: ConfigService) {}

  build(data: AttachedDocumentData): string {
    const doc = create({ version: "1.0", encoding: "UTF-8" }).ele(
      "AttachedDocument",
      {
        xmlns: "urn:oasis:names:specification:ubl:schema:xsd:AttachedDocument-2",
        "xmlns:cac":
          "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
        "xmlns:cbc":
          "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
        "xmlns:ext":
          "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      },
    );

    doc.ele("cbc:UBLVersionID").txt("UBL 2.1").up();
    doc.ele("cbc:CustomizationID").txt("Documentos adjuntos").up();
    doc.ele("cbc:ProfileID").txt("Factura Electrónica de Venta").up();
    doc.ele("cbc:ProfileExecutionID").txt("1").up();
    doc.ele("cbc:ID").txt(data.documentId).up();
    doc.ele("cbc:IssueDate").txt(data.issueDate).up();
    doc.ele("cbc:IssueTime").txt(data.issueTime).up();
    doc.ele("cbc:DocumentType").txt("AttachedDocument").up();
    doc.ele("cbc:ParentDocumentID").txt(data.documentId).up();

    // SenderParty
    doc
      .ele("cac:SenderParty")
      .ele("cac:PartyTaxScheme")
      .ele("cbc:RegistrationName")
      .txt(data.issuer.name)
      .up()
      .ele("cbc:CompanyID", {
        schemeID: "31",
        schemeName: "NIT",
        schemeAgencyID: "195",
      })
      .txt(data.issuer.nit)
      .up()
      .ele("cac:TaxScheme")
      .ele("cbc:ID")
      .txt("01")
      .up()
      .up()
      .up()
      .up();

    // ReceiverParty
    doc
      .ele("cac:ReceiverParty")
      .ele("cac:PartyTaxScheme")
      .ele("cbc:RegistrationName")
      .txt(data.customer.name)
      .up()
      .ele("cbc:CompanyID", {
        schemeID: data.customer.documentType,
        schemeName: "Documento de Identificación",
        schemeAgencyID: "195",
      })
      .txt(data.customer.documentNumber)
      .up()
      .ele("cac:TaxScheme")
      .ele("cbc:ID")
      .txt("01")
      .up()
      .up()
      .up()
      .up();

    // Attachment (Signed Invoice XML)
    doc
      .ele("cac:Attachment")
      .ele("cac:ExternalReference")
      .ele("cbc:MimeCode")
      .txt("text/xml")
      .up()
      .ele("cbc:EncodingCode")
      .txt("UTF-8")
      .up()
      .ele("cbc:Description")
      .dat(data.signedInvoiceXml)
      .up()
      .up()
      .up();

    // ParentDocumentLineReference (ApplicationResponse)
    doc
      .ele("cac:ParentDocumentLineReference")
      .ele("cbc:LineID")
      .txt("1")
      .up()
      .ele("cac:DocumentReference")
      .ele("cbc:ID")
      .txt(data.documentId)
      .up()
      .ele("cbc:UUID", { schemeName: "CUFE-SHA384" })
      .txt(data.cufe)
      .up()
      .ele("cbc:IssueDate")
      .txt(data.issueDate)
      .up()
      .ele("cbc:DocumentTypeCode")
      .txt(data.invoiceType)
      .up()
      .ele("cac:Attachment")
      .ele("cac:ExternalReference")
      .ele("cbc:MimeCode")
      .txt("text/xml")
      .up()
      .ele("cbc:EncodingCode")
      .txt("UTF-8")
      .up()
      .ele("cbc:Description")
      .dat(data.applicationResponseXml)
      .up()
      .up()
      .up()
      .ele("cac:ResultOfVerification")
      .ele("cbc:ValidatorID")
      .txt("Unidad Administrativa Especial Dirección de Impuestos y Aduanas Nacionales")
      .up()
      .ele("cbc:ValidationResultCode")
      .txt("02") // 02 means accepted usually, or we can leave it hardcoded as it's just descriptive here
      .up()
      .ele("cbc:ValidationDate")
      .txt(data.issueDate)
      .up()
      .ele("cbc:ValidationTime")
      .txt(data.issueTime)
      .up()
      .up()
      .up()
      .up();

    return doc.end({ prettyPrint: true, headless: false });
  }
}
