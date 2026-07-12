import { Test, TestingModule } from '@nestjs/testing';
import { CryptoService } from './crypto.service';
import { ConfigService } from '@nestjs/config';

describe('CryptoService', () => {
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
                return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
              }
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
  });

  it('should encrypt and decrypt', () => {
    const plaintext = 'Hello World!';
    const encrypted = service.encrypt(plaintext);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();

    const decrypted = service.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag);
    expect(decrypted).toBe(plaintext);
  });

  it('should fail with wrong auth tag', () => {
    const encrypted = service.encrypt('test');
    expect(() => {
      service.decrypt(encrypted.ciphertext, encrypted.iv, '00000000000000000000000000000000');
    }).toThrow();
  });
});
