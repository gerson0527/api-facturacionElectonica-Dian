import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import * as forge from "node-forge";
import * as crypto from "crypto";
import { readFile } from "fs/promises";

export interface SigningResult {
  signedXml: string;
  certificateBase64: string;
}

const DIAN_SIGNATURE_POLICY_ID =
  "https://facturaelectronica.dian.gov.co/politicadefirma/v2/politicadefirmav2.pdf";
const DIAN_SIGNATURE_POLICY_HASH =
  "QaN7qGL9X5nGz8fE3tR6yU2iK8pL0sW4vB1cD5mH7jA=";

@Injectable()
export class SigningService {
  private readonly logger = new Logger(SigningService.name);

  async signXml(
    xmlContent: string,
    p12Path: string,
    password: string,
  ): Promise<SigningResult> {
    const p12Buffer = await readFile(p12Path);
    return this.signXmlFromBuffer(xmlContent, p12Buffer, password);
  }

  async signXmlFromBuffer(
    xmlContent: string,
    p12Buffer: Buffer,
    password: string,
  ): Promise<SigningResult> {
    const p12Asn1 = forge.asn1.fromDer(
      forge.util.createBuffer(p12Buffer.toString("binary")),
    );
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

    const keyBag =
      p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
        forge.pki.oids.pkcs8ShroudedKeyBag
      ]?.[0]?.key ||
      p12.getBags({ bagType: forge.pki.oids.keyBag })[
        forge.pki.oids.keyBag
      ]?.[0]?.key;
    const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ]?.[0]?.cert;

    if (!keyBag || !certBag) {
      throw new Error(
        "No se pudo extraer llave privada o certificado del .p12",
      );
    }

    await this.validateCertificate(certBag);

    const privateKeyPem = forge.pki.privateKeyToPem(keyBag);
    const certDer = forge.asn1
      .toDer(forge.pki.certificateToAsn1(certBag))
      .getBytes();
    const certificateBase64 = forge.util.encode64(certDer);
    const certPem = forge.pki.certificateToPem(certBag);

    const issuerStr =
      certBag.issuer?.attributes
        ?.map((a: any) => `${a.shortName || a.name}=${a.value}`)
        .join(", ") || "";
    const serialNumber = certBag.serialNumber || "";

    const certDigest = crypto
      .createHash("sha256")
      .update(certDer, "binary")
      .digest("base64");
    const signingTime = new Date().toISOString().replace(/\.\d{3}Z/, "Z");

    const signedPropertiesXml = [
      '<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xmldsig-xades-signedprops">',
      "<xades:SignedSignatureProperties>",
      `<xades:SigningTime>${signingTime}</xades:SigningTime>`,
      "<xades:SigningCertificate>",
      "<xades:Cert>",
      "<xades:CertDigest>",
      `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>`,
      `<ds:DigestValue>${certDigest}</ds:DigestValue>`,
      "</xades:CertDigest>",
      "<xades:IssuerSerial>",
      `<ds:X509IssuerName>${issuerStr}</ds:X509IssuerName>`,
      `<ds:X509SerialNumber>${serialNumber}</ds:X509SerialNumber>`,
      "</xades:IssuerSerial>",
      "</xades:Cert>",
      "</xades:SigningCertificate>",
      "<xades:SignaturePolicyIdentifier>",
      "<xades:SignaturePolicyId>",
      `<xades:SigPolicyId><xades:Identifier>${DIAN_SIGNATURE_POLICY_ID}</xades:Identifier></xades:SigPolicyId>`,
      "<xades:SigPolicyHash>",
      '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>',
      `<ds:DigestValue>${DIAN_SIGNATURE_POLICY_HASH}</ds:DigestValue>`,
      "</xades:SigPolicyHash>",
      "</xades:SignaturePolicyId>",
      "</xades:SignaturePolicyIdentifier>",
      "</xades:SignedSignatureProperties>",
      "</xades:SignedProperties>",
    ].join("");

    const signedPropsDigest = crypto
      .createHash("sha256")
      .update(signedPropertiesXml, "utf8")
      .digest("base64");

    const signedInfoXml = [
      '<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">',
      '<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
      '<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>',
      '<ds:Reference URI="">',
      "<ds:Transforms>",
      '<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>',
      '<ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
      "</ds:Transforms>",
      '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>',
      `<ds:DigestValue>${crypto.createHash("sha256").update(xmlContent, "utf8").digest("base64")}</ds:DigestValue>`,
      "</ds:Reference>",
      '<ds:Reference URI="#xmldsig-xades-signedprops" type="http://uri.etsi.org/01903#SignedProperties">',
      '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>',
      `<ds:DigestValue>${signedPropsDigest}</ds:DigestValue>`,
      "</ds:Reference>",
      "</ds:SignedInfo>",
    ].join("");

    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signedInfoXml, "utf8");
    const signatureValue = signer.sign(privateKeyPem, "base64");

    const signatureXml = [
      '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="xmldsig-signature" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">',
      signedInfoXml,
      `<ds:SignatureValue>${signatureValue}</ds:SignatureValue>`,
      "<ds:KeyInfo>",
      "<ds:X509Data>",
      "<ds:X509IssuerSerial>",
      `<ds:X509IssuerName>${issuerStr}</ds:X509IssuerName>`,
      `<ds:X509SerialNumber>${serialNumber}</ds:X509SerialNumber>`,
      "</ds:X509IssuerSerial>",
      `<ds:X509Certificate>${certificateBase64}</ds:X509Certificate>`,
      "</ds:X509Data>",
      "</ds:KeyInfo>",
      "<ds:Object>",
      signedPropertiesXml,
      "</ds:Object>",
      "</ds:Signature>",
    ].join("");

    const signedXml = this.insertSignatureIntoXml(xmlContent, signatureXml);
    return { signedXml, certificateBase64 };
  }

  private async validateCertificate(
    cert: forge.pki.Certificate,
  ): Promise<void> {
    const now = new Date();
    if (cert.validity.notAfter < now) {
      throw new BadRequestException(
        `El certificado digital expiró el ${cert.validity.notAfter.toISOString().split("T")[0]}. Debe renovarlo.`,
      );
    }
    if (cert.validity.notBefore > now) {
      throw new BadRequestException("El certificado digital aún no es válido");
    }
    const daysLeft = Math.floor(
      (cert.validity.notAfter.getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    this.logger.log(
      `Certificado válido: expira en ${daysLeft} días (${cert.validity.notAfter.toISOString().split("T")[0]})`,
    );
  }

  private insertSignatureIntoXml(xml: string, signatureXml: string): string {
    if (xml.includes("__SIGNATURE_PLACEHOLDER__")) {
      return xml.replace("__SIGNATURE_PLACEHOLDER__", signatureXml);
    }
    const marker = "</ext:UBLExtensions>";
    const idx = xml.indexOf(marker);
    if (idx === -1) {
      return xml
        .replace("</Invoice>", signatureXml + "\n</Invoice>")
        .replace("</CreditNote>", signatureXml + "\n</CreditNote>")
        .replace("</DebitNote>", signatureXml + "\n</DebitNote>");
    }
    return xml.slice(0, idx) + signatureXml + "\n    " + xml.slice(idx);
  }

  async buildWsseSecurityHeader(
    bodyXml: string,
    p12Buffer: Buffer,
    password: string,
  ): Promise<{ securityHeader: string; bodyWithId: string }> {
    const { v4: uuidv4 } = require("uuid");
    
    const p12Asn1 = forge.asn1.fromDer(
      forge.util.createBuffer(p12Buffer.toString("binary")),
    );
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

    const keyBag =
      p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
        forge.pki.oids.pkcs8ShroudedKeyBag
      ]?.[0]?.key ||
      p12.getBags({ bagType: forge.pki.oids.keyBag })[
        forge.pki.oids.keyBag
      ]?.[0]?.key;
    const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ]?.[0]?.cert;

    if (!keyBag || !certBag) {
      throw new Error("No se pudo extraer llave privada o certificado del .p12");
    }

    const privateKeyPem = forge.pki.privateKeyToPem(keyBag);
    const certDer = forge.asn1
      .toDer(forge.pki.certificateToAsn1(certBag))
      .getBytes();
    const certificateBase64 = forge.util.encode64(certDer);

    const bodyUuid = uuidv4().replace(/-/g, "");
    const timestampUuid = uuidv4().replace(/-/g, "");
    const sigUuid = uuidv4().replace(/-/g, "");

    const now = new Date();
    const expires = new Date(now.getTime() + 5 * 60000); // 5 minutes

    const createdTime = now.toISOString().replace(/\.\d{3}Z/, "Z");
    const expiresTime = expires.toISOString().replace(/\.\d{3}Z/, "Z");

    const bodyWithId = bodyXml.replace(
      "<soap:Body>",
      `<soap:Body xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" wsu:Id="ID-${bodyUuid}">`
    );

    // To compute digest, we should strictly canonicalize, but for DIAN WCF simple string match often works if namespaces are exact.
    // The safest is to extract exactly the inner XML of soap:Body and timestamp.
    // WCF strictly requires Exc-C14N.
    const bodyMatch = bodyWithId.match(/<soap:Body[^>]*>[\s\S]*?<\/soap:Body>/);
    const bodyStr = bodyMatch ? bodyMatch[0] : bodyWithId;

    const bodyDigest = crypto
      .createHash("sha256")
      .update(bodyStr, "utf8")
      .digest("base64");

    const timestampStr = `<wsu:Timestamp xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" wsu:Id="TS-${timestampUuid}"><wsu:Created>${createdTime}</wsu:Created><wsu:Expires>${expiresTime}</wsu:Expires></wsu:Timestamp>`;
    const timestampDigest = crypto
      .createHash("sha256")
      .update(timestampStr, "utf8")
      .digest("base64");

    const signedInfoStr = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><ds:Reference URI="#ID-${bodyUuid}"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>${bodyDigest}</ds:DigestValue></ds:Reference><ds:Reference URI="#TS-${timestampUuid}"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>${timestampDigest}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;

    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signedInfoStr, "utf8");
    const signatureValue = signer.sign(privateKeyPem, "base64");

    const securityHeader = `
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
      <wsse:BinarySecurityToken EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" wsu:Id="X509-${sigUuid}">${certificateBase64}</wsse:BinarySecurityToken>
      <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="SIG-${sigUuid}">
        ${signedInfoStr}
        <ds:SignatureValue>${signatureValue}</ds:SignatureValue>
        <ds:KeyInfo Id="KI-${sigUuid}">
          <wsse:SecurityTokenReference wsu:Id="STR-${sigUuid}">
            <wsse:Reference URI="#X509-${sigUuid}" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/>
          </wsse:SecurityTokenReference>
        </ds:KeyInfo>
      </ds:Signature>
      ${timestampStr.replace(' xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"', '')}
    </wsse:Security>`.trim();

    return { securityHeader, bodyWithId };
  }
}
