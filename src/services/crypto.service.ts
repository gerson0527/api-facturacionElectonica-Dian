import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

export interface EncryptResult {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

export interface DecryptInput {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion?: number;
}

@Injectable()
export class CryptoService {
  private currentKey: Buffer;
  private currentKeyVersion: number;
  private keyHistory: Map<number, Buffer> = new Map();

  constructor(private configService: ConfigService) {
    const keyHex = this.configService.get<string>('ENCRYPTION_KEY');
    if (!keyHex) {
      throw new Error('ENCRYPTION_KEY no está configurada');
    }
    this.currentKey = Buffer.from(keyHex, 'hex');
    this.currentKeyVersion = this.configService.get<number>('ENCRYPTION_KEY_VERSION') || 1;
    this.keyHistory.set(this.currentKeyVersion, this.currentKey);
  }

  encrypt(plaintext: string, aad?: string): EncryptResult {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.currentKey, iv);

    if (aad) {
      cipher.setAAD(Buffer.from(aad, 'utf8'));
    }

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return { ciphertext: encrypted, iv: iv.toString('hex'), authTag, keyVersion: this.currentKeyVersion };
  }

  decrypt(input: DecryptInput, aad?: string): string;
  decrypt(ciphertext: string, iv: string, authTag: string): string;
  decrypt(inputOrCiphertext: DecryptInput | string, aadOrIv?: string, authTag?: string): string {
    let result: DecryptInput;
    let aad: string | undefined;

    if (typeof inputOrCiphertext === 'string') {
      result = { ciphertext: inputOrCiphertext, iv: aadOrIv!, authTag: authTag! };
    } else {
      result = inputOrCiphertext;
      aad = aadOrIv;
    }

    const keyVersion = result.keyVersion ?? this.currentKeyVersion;
    const key = this.keyHistory.get(keyVersion) || this.currentKey;

    const iv = Buffer.from(result.iv, 'hex');
    const tag = Buffer.from(result.authTag, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    if (aad) {
      decipher.setAAD(Buffer.from(aad, 'utf8'));
    }

    let decrypted = decipher.update(result.ciphertext, 'hex', 'utf8');
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
