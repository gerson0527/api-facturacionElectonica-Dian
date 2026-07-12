import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService - Integration', () => {
  let service: CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'ENCRYPTION_KEY') {
                return 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
              }
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
  });

  it('debe cifrar y descifrar correctamente strings largos', () => {
    const plaintext = 'A'.repeat(10000);
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag);
    expect(decrypted).toBe(plaintext);
  });

  it('debe producir IVs únicos en cada cifrado', () => {
    const encrypted1 = service.encrypt('test data');
    const encrypted2 = service.encrypt('test data');
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
  });

  it('debe fallar al descifrar con authTag incorrecto', () => {
    const encrypted = service.encrypt('datos sensibles');
    expect(() => {
      service.decrypt(encrypted.ciphertext, encrypted.iv, '11111111111111111111111111111111');
    }).toThrow();
  });

  it('debe cifrar y descifrar objetos JSON correctamente', () => {
    const obj = { softwareId: '123456789', pin: 'test-pin-123', testSetId: 'test-set-1' };
    const encryptedJson = service.encryptObject(obj);
    const decrypted = service.decryptToObject<typeof obj>(encryptedJson);
    expect(decrypted.softwareId).toBe(obj.softwareId);
    expect(decrypted.pin).toBe(obj.pin);
    expect(decrypted.testSetId).toBe(obj.testSetId);
  });

  it('debe fallar con clave incorrecta (simulado cambiando ConfigService)', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: () => 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          },
        },
      ],
    }).compile();

    const service2 = module.get<CryptoService>(CryptoService);
    const encrypted = service.encrypt('mensaje original');

    expect(() => {
      service2.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag);
    }).toThrow();
  });
});
