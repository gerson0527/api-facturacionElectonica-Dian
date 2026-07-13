import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

export interface EncryptResult {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  integrityHash?: string;
}

export interface DecryptInput {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion?: number;
  integrityHash?: string;
}

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
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

    const historyJson = this.configService.get<string>('ENCRYPTION_KEY_HISTORY');
    if (historyJson) {
      try {
        const history = JSON.parse(historyJson) as Record<string, string>;
        for (const [ver, hex] of Object.entries(history)) {
          const v = parseInt(ver, 10);
          if (v !== this.currentKeyVersion) {
            this.keyHistory.set(v, Buffer.from(hex, 'hex'));
          }
        }
        this.logger.log(`Cargadas ${Object.keys(history).length} claves previas del historial`);
      } catch {
        this.logger.warn('ENCRYPTION_KEY_HISTORY inválido, ignorando');
      }
    }
  }

  encrypt(plaintext: string, aad?: string, withIntegrity?: boolean): EncryptResult {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.currentKey, iv);

    if (aad) {
      cipher.setAAD(Buffer.from(aad, 'utf8'));
    }

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    const result: EncryptResult = {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag,
      keyVersion: this.currentKeyVersion,
    };

    if (withIntegrity) {
      result.integrityHash = crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
    }

    return result;
  }

  decrypt(input: DecryptInput, aad?: string): string;
  decrypt(ciphertext: string, iv: string, authTag: string, aad?: string): string;
  decrypt(inputOrCiphertext: DecryptInput | string, aadOrIv?: string, authTagOrAad?: string, aad?: string): string {
    let result: DecryptInput;
    let aadValue: string | undefined;

    if (typeof inputOrCiphertext === 'string') {
      result = { ciphertext: inputOrCiphertext, iv: aadOrIv!, authTag: authTagOrAad! };
      aadValue = aad;
    } else {
      result = inputOrCiphertext;
      aadValue = aadOrIv;
    }

    const keyVersion = result.keyVersion ?? this.currentKeyVersion;
    const key = this.keyHistory.get(keyVersion) || this.currentKey;

    const iv = Buffer.from(result.iv, 'hex');
    const tag = Buffer.from(result.authTag, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    if (aadValue) {
      decipher.setAAD(Buffer.from(aadValue, 'utf8'));
    }

    let decrypted = decipher.update(result.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    if (result.integrityHash) {
      const computed = crypto.createHash('sha256').update(decrypted, 'utf8').digest('hex');
      if (computed !== result.integrityHash) {
        throw new Error('Integrity check failed: el contenido descifrado no coincide con el hash');
      }
    }

    return decrypted;
  }

  encryptWithIntegrity(plaintext: string, aad?: string): EncryptResult {
    const result = this.encrypt(plaintext, aad, true);
    return result;
  }

  addKey(version: number, keyHex: string): void {
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
      throw new Error(`La clave debe ser de 32 bytes (64 hex), recibió ${key.length * 2} hex`);
    }
    this.keyHistory.set(version, key);
    this.logger.log(`Clave versión ${version} registrada en historial`);
  }

  rotateKey(newKeyHex: string, newVersion: number): void {
    this.addKey(newVersion, newKeyHex);
    this.currentKey = this.keyHistory.get(newVersion)!;
    this.currentKeyVersion = newVersion;
    this.logger.log(`Rotación a clave versión ${newVersion} completada`);
  }

  encryptObject(obj: Record<string, any>, aad?: string): string {
    const json = JSON.stringify(obj);
    const result = this.encrypt(json, aad);
    return JSON.stringify(result);
  }

  decryptToObject<T = Record<string, any>>(encryptedJson: string, aad?: string): T {
    const parsed = JSON.parse(encryptedJson);
    const decrypted = this.decrypt(parsed.ciphertext, parsed.iv, parsed.authTag, aad);
    return JSON.parse(decrypted) as T;
  }

  getCurrentKeyVersion(): number {
    return this.currentKeyVersion;
  }
}
