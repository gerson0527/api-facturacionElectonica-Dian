import { Injectable, Logger } from '@nestjs/common';
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
    const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Buffer.toString('binary')));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

    const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key
      || p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0]?.key;
    const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0]?.cert;

    if (!keyBag || !certBag) {
      throw new Error('No se pudo extraer llave privada o certificado del .p12');
    }

    const privateKeyPem = forge.pki.privateKeyToPem(keyBag);
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certBag)).getBytes();
    const certificateBase64 = forge.util.encode64(certDer);

    // Canonicalize the document (C14N)
    const documentC14n = xmlContent;

    // Calculate digest of the document
    const digestValue = crypto.createHash('sha256').update(documentC14n, 'utf8').digest('base64');

    // Build SignedInfo XML for XAdES-EPES
    const signedInfoXml = [
      '<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">',
      '<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
      '<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>',
      '<ds:Reference URI="">',
      '<ds:Transforms>',
      '<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>',
      '<ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
      '</ds:Transforms>',
      '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>',
      `<ds:DigestValue>${digestValue}</ds:DigestValue>`,
      '</ds:Reference>',
      '</ds:SignedInfo>',
    ].join('');

    // Sign the SignedInfo
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signedInfoXml, 'utf8');
    const signatureValue = signer.sign(privateKeyPem, 'base64');

    // Build XAdES-EPES signature XML
    const signatureXml = [
      '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="factura-electronica">',
      signedInfoXml,
      `<ds:SignatureValue>${signatureValue}</ds:SignatureValue>`,
      '<ds:KeyInfo>',
      '<ds:X509Data>',
      `<ds:X509Certificate>${certificateBase64}</ds:X509Certificate>`,
      '</ds:X509Data>',
      '</ds:KeyInfo>',
      '</ds:Signature>',
    ].join('');

    // Insert signature into the second UBLExtension
    const signedXml = this.insertSignatureIntoXml(xmlContent, signatureXml);

    return { signedXml, certificateBase64 };
  }

  private insertSignatureIntoXml(xml: string, signatureXml: string): string {
    const marker = '</ext:ExtensionContent>\n      </ext:UBLExtension>\n    </ext:UBLExtensions>';
    const firstExtEnd = xml.indexOf(marker);
    if (firstExtEnd === -1) {
      throw new Error('No se encontró el marcador UBLExtensions');
    }
    const before = xml.substring(0, firstExtEnd);
    const after = xml.substring(firstExtEnd);
    return before + signatureXml + after;
  }
}
