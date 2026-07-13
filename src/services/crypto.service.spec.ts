import { Test, TestingModule } from "@nestjs/testing";
import { CryptoService } from "./crypto.service";
import { ConfigService } from "@nestjs/config";

const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("CryptoService", () => {
  let service: CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "ENCRYPTION_KEY") return TEST_KEY;
              if (key === "ENCRYPTION_KEY_VERSION") return 1;
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
  });

  it("should encrypt and decrypt", () => {
    const plaintext = "Hello World!";
    const encrypted = service.encrypt(plaintext);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.keyVersion).toBe(1);

    const decrypted = service.decrypt(
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.authTag,
    );
    expect(decrypted).toBe(plaintext);
  });

  it("should fail with wrong auth tag", () => {
    const encrypted = service.encrypt("test");
    expect(() => {
      service.decrypt(
        encrypted.ciphertext,
        encrypted.iv,
        "00000000000000000000000000000000",
      );
    }).toThrow();
  });

  it("should encrypt with AAD and decrypt with same AAD", () => {
    const plaintext = "secret data";
    const aad = "software-pin:tenant-1:sw-1";
    const encrypted = service.encrypt(plaintext, aad);
    const decrypted = service.decrypt(encrypted, aad);
    expect(decrypted).toBe(plaintext);
  });

  it("should fail to decrypt with wrong AAD", () => {
    const plaintext = "secret data";
    const encrypted = service.encrypt(plaintext, "correct-aad");
    expect(() => service.decrypt(encrypted, "wrong-aad")).toThrow();
  });

  it("should encrypt with integrity hash and verify on decrypt", () => {
    const plaintext = "data with integrity";
    const encrypted = service.encrypt(plaintext, undefined, true);
    expect(encrypted.integrityHash).toBeDefined();

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should fail decrypt with tampered integrity hash", () => {
    const plaintext = "original data";
    const encrypted = service.encrypt(plaintext, undefined, true);
    encrypted.integrityHash =
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    expect(() => service.decrypt(encrypted)).toThrow("Integrity check failed");
  });

  it("should encryptWithIntegrity as a convenience method", () => {
    const plaintext = "data";
    const aad = "ctx:1";
    const encrypted = service.encryptWithIntegrity(plaintext, aad);
    expect(encrypted.integrityHash).toBeDefined();

    const decrypted = service.decrypt(encrypted, aad);
    expect(decrypted).toBe(plaintext);
  });

  it("should support key rotation via addKey", () => {
    const newKey =
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    service.addKey(2, newKey);
    expect(service.getCurrentKeyVersion()).toBe(1);
  });

  it("should support key rotation via rotateKey", () => {
    const newKey =
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    service.rotateKey(newKey, 2);
    expect(service.getCurrentKeyVersion()).toBe(2);

    const plaintext = "rotated key data";
    const encrypted = service.encrypt(plaintext);
    expect(encrypted.keyVersion).toBe(2);
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should decrypt data encrypted with old key after rotation", () => {
    const oldData = service.encrypt("data under old key");
    expect(oldData.keyVersion).toBe(1);

    const newKey =
      "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
    service.rotateKey(newKey, 2);

    const decrypted = service.decrypt(oldData);
    expect(decrypted).toBe("data under old key");
  });

  it("should reject invalid key hex length", () => {
    expect(() => service.addKey(2, "aabb")).toThrow("32 bytes");
  });
});
