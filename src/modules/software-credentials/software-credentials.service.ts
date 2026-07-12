import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DianSoftwareCredential } from '@/database/entities/dian-software-credential.entity';
import { Tenant } from '@/database/entities/tenant.entity';
import { CryptoService } from '@/services/crypto.service';

@Injectable()
export class SoftwareCredentialsService {
  constructor(
    @InjectRepository(DianSoftwareCredential)
    private readonly credRepo: Repository<DianSoftwareCredential>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly cryptoService: CryptoService,
  ) {}

  async create(
    tenantId: string,
    data: { softwareId: string; softwarePin: string; testSetId?: string },
  ): Promise<DianSoftwareCredential> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado');
    }

    const encrypted = this.cryptoService.encrypt(data.softwarePin);

    const credential = this.credRepo.create({
      tenantId,
      softwareId: data.softwareId,
      softwarePinEncrypted: JSON.stringify(encrypted),
      testSetId: data.testSetId,
      habilitacionStatus: 'pending',
    });
    return this.credRepo.save(credential);
  }

  async findByTenant(tenantId: string): Promise<DianSoftwareCredential[]> {
    return this.credRepo.find({ where: { tenantId } });
  }

  async findOne(id: string, tenantId: string): Promise<DianSoftwareCredential> {
    const cred = await this.credRepo.findOne({ where: { id, tenantId } });
    if (!cred) {
      throw new NotFoundException('Credencial no encontrada');
    }
    return cred;
  }

  async decryptPin(credential: DianSoftwareCredential): Promise<string> {
    const parsed = JSON.parse(credential.softwarePinEncrypted);
    return this.cryptoService.decrypt(parsed.ciphertext, parsed.iv, parsed.authTag);
  }
}
