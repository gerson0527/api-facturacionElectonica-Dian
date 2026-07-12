import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

@Injectable()
export class CryptoService {
  private encryptionKey: Buffer;

  constructor(private configService: ConfigService) {
    const keyHex = this.configService.get<string>('ENCRYPTION_KEY');
    if (!keyHex) {
      throw new Error('ENCRYPTION_KEY no está configurada');
    }
    this.encryptionKey = Buffer.from(keyHex, 'hex');
  }

  encrypt(plaintext: string): { ciphertext: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag,
    };
  }

  decrypt(ciphertext: string, ivHex: string, authTagHex: string): string {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  encryptObject(obj: Record<string, any>): string {
    const json = JSON.stringify(obj);
    const result = this.encrypt(json);
    return JSON.stringify(result);
  }

  decryptToObject<T = Record<string, any>>(encryptedJson: string): T {
    const parsed = JSON.parse(encryptedJson);
    const decrypted = this.decrypt(parsed.ciphertext, parsed.iv, parsed.authTag);
    return JSON.parse(decrypted) as T;
  }
}
