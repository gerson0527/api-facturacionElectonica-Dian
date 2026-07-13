import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { DigitalCertificate } from '@/database/entities/digital-certificate.entity';
import { Tenant } from '@/database/entities/tenant.entity';
import { CryptoService } from '@/services/crypto.service';

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);
  private readonly storagePath: string;

  constructor(
    @InjectRepository(DigitalCertificate)
    private readonly certRepo: Repository<DigitalCertificate>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly cryptoService: CryptoService,
    private configService: ConfigService,
  ) {
    this.storagePath = this.configService.get<string>('STORAGE_PATH') || './storage';
  }

  async upload(
    tenantId: string,
    alias: string,
    pfxBuffer: Buffer,
    pfxPassword: string,
    pin?: string,
  ): Promise<DigitalCertificate> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado');
    }

    const certDir = path.join(this.storagePath, 'certificates', tenantId);
    await fs.mkdir(certDir, { recursive: true });

    const pfxAad = `pfx:${tenantId}:${alias}`;
    const pwdAad = `pfx-password:${tenantId}:${alias}`;
    const encryptedPfx = this.cryptoService.encryptWithIntegrity(pfxBuffer.toString('base64'), pfxAad);
    const encryptedPassword = this.cryptoService.encrypt(pfxPassword, pwdAad);

    const pfxFileName = `${uuidv4()}.enc`;
    const pfxPath = path.join(certDir, pfxFileName);
    await fs.writeFile(pfxPath, JSON.stringify(encryptedPfx));

    let encryptedPinRef = '';
    if (pin) {
      const pinAad = `pfx-pin:${tenantId}:${alias}`;
      const encryptedPin = this.cryptoService.encrypt(pin, pinAad);
      encryptedPinRef = JSON.stringify(encryptedPin);
    }

    const certificate = this.certRepo.create({
      tenantId,
      alias,
      encryptedPfxPath: pfxPath,
      encryptedPasswordRef: JSON.stringify(encryptedPassword),
      encryptedPinRef: encryptedPinRef || undefined,
      isActive: true,
    });
    return this.certRepo.save(certificate);
  }

  async findByTenant(tenantId: string): Promise<DigitalCertificate[]> {
    return this.certRepo.find({ where: { tenantId, isActive: true } });
  }

  async getDecryptedPfx(id: string, tenantId: string): Promise<{ pfxBuffer: Buffer; password: string; pin?: string }> {
    const cert = await this.certRepo.findOne({ where: { id, tenantId, isActive: true } });
    if (!cert) {
      throw new NotFoundException('Certificado no encontrado');
    }

    const encPfxRaw = await fs.readFile(cert.encryptedPfxPath, 'utf-8');
    const encPfx = JSON.parse(encPfxRaw);
    const pfxAad = `pfx:${cert.tenantId}:${cert.alias}`;
    const pfxBase64 = this.cryptoService.decrypt(encPfx, pfxAad);
    const pfxBuffer = Buffer.from(pfxBase64, 'base64');

    const encPassword = JSON.parse(cert.encryptedPasswordRef);
    const pwdAad = `pfx-password:${cert.tenantId}:${cert.alias}`;
    const password = this.cryptoService.decrypt(encPassword, pwdAad);

    let pin: string | undefined;
    if (cert.encryptedPinRef) {
      const encPin = JSON.parse(cert.encryptedPinRef);
      const pinAad = `pfx-pin:${cert.tenantId}:${cert.alias}`;
      pin = this.cryptoService.decrypt(encPin, pinAad);
    }

    return { pfxBuffer, password, pin };
  }
}
