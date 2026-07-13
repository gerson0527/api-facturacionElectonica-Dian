import { Test, TestingModule } from "@nestjs/testing";
import { SigningService } from "./signing.service";
import { BadRequestException } from "@nestjs/common";
import * as forge from "node-forge";
import { createHash } from "crypto";

function generateSelfSignedP12(password: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date("2024-01-01");
  cert.validity.notAfter = new Date("2034-12-31");
  cert.setSubject([
    { name: "commonName", value: "Test DIAN" },
    { name: "organizationName", value: "Test SAS" },
  ]);
  cert.setIssuer([
    { name: "commonName", value: "Test CA" },
    { name: "organizationName", value: "Test SAS" },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, password, {
    algorithm: "3des",
  });
  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), "binary");
}

const TEST_PASSWORD = "test123";

describe("SigningService", () => {
  let service: SigningService;
  let p12Buffer: Buffer;

  beforeAll(() => {
    p12Buffer = generateSelfSignedP12(TEST_PASSWORD);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SigningService],
    }).compile();
    service = module.get<SigningService>(SigningService);
  });

  it("debe firmar XML y retornar signedXml + certificateBase64", async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?><Invoice><ID>FAC-001</ID></Invoice>';
    const result = await service.signXmlFromBuffer(
      xml,
      p12Buffer,
      TEST_PASSWORD,
    );
    expect(result.signedXml).toBeTruthy();
    expect(result.certificateBase64).toBeTruthy();
    expect(result.signedXml).toContain("ds:Signature");
    expect(result.signedXml).toContain("ds:SignedInfo");
    expect(result.signedXml).toContain("xades:SignedProperties");
    expect(result.signedXml).toContain("xades:SigningTime");
    expect(result.signedXml).toContain("xades:SigningCertificate");
    expect(result.signedXml).toContain("xades:SignaturePolicyId");
    expect(result.signedXml).toContain("xades:SigPolicyHash");
    expect(result.signedXml).toContain("xades:IssuerSerial");
    expect(result.signedXml).toContain("ds:SignatureValue");
    expect(result.signedXml).toContain("ds:X509Certificate");
  });

  it("debe rechazar certificado expirado", async () => {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = "01";
    cert.validity.notBefore = new Date("2020-01-01");
    cert.validity.notAfter = new Date("2021-12-31");
    cert.setSubject([{ name: "commonName", value: "Expired" }]);
    cert.setIssuer([{ name: "commonName", value: "Expired" }]);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const expiredP12 = forge.pkcs12.toPkcs12Asn1(
      keys.privateKey,
      cert,
      "pass",
      { algorithm: "3des" },
    );
    const expiredBuffer = Buffer.from(
      forge.asn1.toDer(expiredP12).getBytes(),
      "binary",
    );

    await expect(
      service.signXmlFromBuffer("<a></a>", expiredBuffer, "pass"),
    ).rejects.toThrow(BadRequestException);
  });

  it("debe incluir referencia a la política de firma DIAN", async () => {
    const xml = "<Invoice></Invoice>";
    const result = await service.signXmlFromBuffer(
      xml,
      p12Buffer,
      TEST_PASSWORD,
    );
    expect(result.signedXml).toContain("politicadefirmav2.pdf");
    expect(result.signedXml).toContain("SigPolicyHash");
  });

  it("debe preservar el contenido original del XML dentro del firmado", async () => {
    const xml =
      '<?xml version="1.0"?><Invoice><ID>FAC-001</ID><Total>1000</Total></Invoice>';
    const result = await service.signXmlFromBuffer(
      xml,
      p12Buffer,
      TEST_PASSWORD,
    );
    expect(result.signedXml).toContain("<ID>FAC-001</ID>");
    expect(result.signedXml).toContain("<Total>1000</Total>");
  });

  it("debe insertar la firma dentro de ext:UBLExtensions cuando existe", async () => {
    const xml =
      '<?xml version="1.0"?><Invoice><ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions></Invoice>';
    const result = await service.signXmlFromBuffer(
      xml,
      p12Buffer,
      TEST_PASSWORD,
    );
    expect(result.signedXml.indexOf("ds:Signature")).toBeLessThan(
      result.signedXml.indexOf("</ext:UBLExtensions>"),
    );
  });

  it("debe fallar con contraseña incorrecta", async () => {
    await expect(
      service.signXmlFromBuffer("<a></a>", p12Buffer, "wrong-password"),
    ).rejects.toThrow();
  });
});
