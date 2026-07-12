import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as forge from 'node-forge';
import * as crypto from 'crypto';
import { readFile } from 'fs/promises';

export interface SigningResult {
  signedXml: string;
  certificateBase64: string;
}

@Injectable()
export class SigningService {
  private readonly logger = new Logger(SigningService.name);

  async signXml(xmlContent: string, p12Path: string, password: string): Promise<SigningResult> {
    const p12Buffer = await readFile(p12Path);
    return this.signXmlFromBuffer(xmlContent, p12Buffer, password);
  }

  async signXmlFromBuffer(xmlContent: string, p12Buffer: Buffer, password: string): Promise<SigningResult> {
    const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Buffer.toString('binary')));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

    const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key
      || p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0]?.key;
    const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0]?.cert;

    if (!keyBag || !certBag) {
      throw new Error('No se pudo extraer llave privada o certificado del .p12');
    }

    this.validateCertificate(certBag);

    const now = new Date();
    const notAfter = certBag.validity.notAfter;
    if (notAfter < now) {
      throw new BadRequestException(
        `El certificado digital expiró el ${notAfter.toISOString().split('T')[0]}. Debe renovarlo.`,
      );
    }
    if (certBag.validity.notBefore > now) {
      throw new BadRequestException('El certificado digital aún no es válido');
    }

    const privateKeyPem = forge.pki.privateKeyToPem(keyBag);
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certBag)).getBytes();
    const certificateBase64 = forge.util.encode64(certDer);

    const certPem = forge.pki.certificateToPem(certBag);

    const documentC14n = xmlContent;

    const digestValue = crypto.createHash('sha256').update(documentC14n, 'utf8').digest('base64');

    const signedInfoXml = [
      '<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">',
      '<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
      '<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>',
      '<ds:Reference URI="#factura-electronica">',
      '<ds:Transforms>',
      '<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>',
      '<ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
      '</ds:Transforms>',
      '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>',
      `<ds:DigestValue>${digestValue}</ds:DigestValue>`,
      '</ds:Reference>',
      '</ds:SignedInfo>',
    ].join('');

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signedInfoXml, 'utf8');
    const signatureValue = signer.sign(privateKeyPem, 'base64');

    const issuerInfo = certBag.issuer;
    const serialNumber = certBag.serialNumber;

    const signatureXml = [
      '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="factura-electronica">',
      signedInfoXml,
      `<ds:SignatureValue>${signatureValue}</ds:SignatureValue>`,
      '<ds:KeyInfo>',
      '<ds:X509Data>',
      `<ds:X509IssuerSerial>`,
      `<ds:X509IssuerName>${forge.pki.distinguishedNameToAsn1(issuerInfo as any)}</ds:X509IssuerName>`,
      `<ds:X509SerialNumber>${serialNumber}</ds:X509SerialNumber>`,
      `</ds:X509IssuerSerial>`,
      `<ds:X509Certificate>${certificateBase64}</ds:X509Certificate>`,
      '</ds:X509Data>',
      '</ds:KeyInfo>',
      '</ds:Signature>',
    ].join('');

    const signedXml = this.insertSignatureIntoXml(xmlContent, signatureXml);

    return { signedXml, certificateBase64 };
  }

  private validateCertificate(cert: forge.pki.Certificate): void {
    const now = new Date();
    if (cert.validity.notAfter < now) {
      this.logger.warn(`Certificado expiró el ${cert.validity.notAfter.toISOString().split('T')[0]}`);
    }
    if (cert.validity.notBefore > now) {
      this.logger.warn('Certificado aún no es válido (fecha futura)');
    }
    const daysLeft = Math.floor((cert.validity.notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft >= 0 && daysLeft <= 30) {
      this.logger.warn(`Certificado expira en ${daysLeft} días (${cert.validity.notAfter.toISOString().split('T')[0]})`);
    }
    this.logger.log(`Certificado válido: emisor=${cert.issuer?.attributes?.find((a: any) => a.name === 'commonName')?.value || 'N/A'}, expira=${cert.validity.notAfter.toISOString().split('T')[0]}, días restantes=${daysLeft}`);
  }

  private insertSignatureIntoXml(xml: string, signatureXml: string): string {
    const marker = '</ext:UBLExtensions>';
    const firstExtEnd = xml.indexOf(marker);
    if (firstExtEnd === -1) {
      throw new Error('No se encontró el marcador UBLExtensions en el XML');
    }
    const before = xml.substring(0, firstExtEnd);
    const after = xml.substring(firstExtEnd);

    const signatureBlock = signatureXml + '\n    ';

    return before + signatureBlock + after;
  }
}
