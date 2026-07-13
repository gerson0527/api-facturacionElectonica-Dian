import { Injectable } from "@nestjs/common";
import { create } from "xmlbuilder2";

export interface RadianEventData {
  eventId: string; // The ID of the event (e.g. event number)
  eventCode: string; // 030, 032, 033, 031
  eventDescription: string;
  issueDate: string;
  issueTime: string;
  cude: string;
  environment: string; // "1" or "2"
  softwareId: string;
  pin: string;
  softwareSecurityCode: string;
  tenant: {
    nit: string;
    dv: string;
    name: string;
  };
  receiver: {
    nit: string;
    dv: string;
    name: string;
  };
  invoice: {
    prefix: string;
    number: string;
    cufe: string;
    issueDate: string;
  };
}

@Injectable()
export class XmlRadianBuilderService {
  buildApplicationResponse(data: RadianEventData): string {
    const doc = create({ version: "1.0", encoding: "UTF-8", standalone: false })
      .ele("ApplicationResponse", {
        "xmlns": "urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2",
        "xmlns:cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
        "xmlns:cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
        "xmlns:ext": "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
        "xmlns:sts": "dian:gov:co:facturaelectronica:Structures-2-1",
      });

    // UBL Extensions
    const extensions = doc.ele("ext:UBLExtensions");

    // Extension 1: DIAN Extensions
    const dianExt = extensions.ele("ext:UBLExtension").ele("ext:ExtensionContent").ele("sts:DianExtensions");
    
    // SoftwareProvider
    const softwareProvider = dianExt.ele("sts:SoftwareProvider");
    softwareProvider.ele("sts:ProviderID", { schemeID: "4", schemeName: "31", schemeAgencyID: "195", schemeAgencyName: "CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" }).txt("800197268"); // NIT de la DIAN como proveedor default según anexo o del emisor
    softwareProvider.ele("sts:SoftwareID", { schemeAgencyID: "195", schemeAgencyName: "CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" }).txt(data.softwareId);
    
    dianExt.ele("sts:SoftwareSecurityCode", { schemeAgencyID: "195", schemeAgencyName: "CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" }).txt(data.softwareSecurityCode);

    // AuthorizationProvider (DIAN)
    dianExt.ele("sts:AuthorizationProvider")
      .ele("sts:AuthorizationProviderID", { schemeID: "4", schemeName: "31", schemeAgencyID: "195", schemeAgencyName: "CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" })
      .txt("800197268");

    // QRCode
    dianExt.ele("sts:QRCode").txt(`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${data.cude}`);

    // Extension 2: Signature
    extensions.ele("ext:UBLExtension").ele("ext:ExtensionContent"); // Will be replaced by signer

    // ApplicationResponse Header
    doc.ele("cbc:UBLVersionID").txt("UBL 2.1");
    doc.ele("cbc:CustomizationID").txt("Documentos recibidos por la DIAN"); // Per Anexo Técnico 1.9 para Eventos
    doc.ele("cbc:ProfileID").txt("DIAN 2.1");
    doc.ele("cbc:ProfileExecutionID").txt(data.environment);
    doc.ele("cbc:ID").txt(data.eventId);
    doc.ele("cbc:UUID", { schemeID: "2", schemeName: "CUDE-SHA384" }).txt(data.cude);
    doc.ele("cbc:IssueDate").txt(data.issueDate);
    doc.ele("cbc:IssueTime").txt(data.issueTime);

    // SenderParty (Who emits the event - Adquiriente in most cases, or Emisor)
    const senderParty = doc.ele("cac:SenderParty").ele("cac:Party");
    senderParty.ele("cac:PartyTaxScheme")
      .ele("cbc:RegistrationName").txt(data.tenant.name).up()
      .ele("cbc:CompanyID", { schemeID: data.tenant.dv, schemeName: "31", schemeAgencyID: "195", schemeAgencyName: "CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" }).txt(data.tenant.nit).up()
      .ele("cac:TaxScheme")
        .ele("cbc:ID").txt("01").up()
        .ele("cbc:Name").txt("IVA");

    // ReceiverParty (Who receives the event - usually the original invoice emitter)
    const receiverParty = doc.ele("cac:ReceiverParty").ele("cac:Party");
    receiverParty.ele("cac:PartyTaxScheme")
      .ele("cbc:RegistrationName").txt(data.receiver.name).up()
      .ele("cbc:CompanyID", { schemeID: data.receiver.dv, schemeName: "31", schemeAgencyID: "195", schemeAgencyName: "CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" }).txt(data.receiver.nit).up()
      .ele("cac:TaxScheme")
        .ele("cbc:ID").txt("01").up()
        .ele("cbc:Name").txt("IVA");

    // DocumentResponse
    const docResponse = doc.ele("cac:DocumentResponse");
    docResponse.ele("cac:Response")
      .ele("cbc:ResponseCode").txt(data.eventCode).up()
      .ele("cbc:Description").txt(data.eventDescription);
    
    // Target Document (Invoice)
    const docRef = docResponse.ele("cac:DocumentReference");
    docRef.ele("cbc:ID").txt(`${data.invoice.prefix}${data.invoice.number}`);
    docRef.ele("cbc:UUID", { schemeName: "CUFE-SHA384" }).txt(data.invoice.cufe);
    docRef.ele("cbc:DocumentTypeCode").txt("01"); // 01 for Invoice

    // Issuer of the target document
    const issuerParty = docRef.ele("cac:IssuerParty");
    issuerParty.ele("cac:PartyTaxScheme")
      .ele("cbc:RegistrationName").txt(data.receiver.name).up()
      .ele("cbc:CompanyID", { schemeID: data.receiver.dv, schemeName: "31", schemeAgencyID: "195", schemeAgencyName: "CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" }).txt(data.receiver.nit).up()
      .ele("cac:TaxScheme")
        .ele("cbc:ID").txt("01").up()
        .ele("cbc:Name").txt("IVA");

    return doc.end({ prettyPrint: true });
  }
}
