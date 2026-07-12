import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { DebitNote } from '@/database/entities/debit-note.entity';
import { Invoice } from '@/database/entities/invoice.entity';
import { DianSoftwareCredential } from '@/database/entities/dian-software-credential.entity';
import { DigitalCertificate } from '@/database/entities/digital-certificate.entity';
import { Tenant } from '@/database/entities/tenant.entity';
import { CufeService } from '@/services/cufe.service';
import { SigningService } from '@/services/signing.service';
import { NumberingRangesService } from '../numbering-ranges/numbering-ranges.service';
import { SoftwareCredentialsService } from '../software-credentials/software-credentials.service';
import { CertificatesService } from '../certificates/certificates.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { create } from 'xmlbuilder2';

@Injectable()
export class DebitNotesService {
  private readonly logger = new Logger(DebitNotesService.name);
  private readonly storagePath: string;

  constructor(
    @InjectRepository(DebitNote)
    private readonly debitNoteRepo: Repository<DebitNote>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(DianSoftwareCredential)
    private readonly softwareCredRepo: Repository<DianSoftwareCredential>,
    @InjectRepository(DigitalCertificate)
    private readonly certRepo: Repository<DigitalCertificate>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly configService: ConfigService,
    private readonly cufeService: CufeService,
    private readonly signingService: SigningService,
    private readonly numberingRangesService: NumberingRangesService,
    private readonly softwareCredentialsService: SoftwareCredentialsService,
    private readonly certificatesService: CertificatesService,
  ) {
    this.storagePath = this.configService.get<string>('STORAGE_PATH') || './storage';
  }

  async create(invoiceId: string, input: { issueDate: string; reasonCode: string; totalAmount: number; prefix: string }): Promise<DebitNote> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    const tenantId = invoice.tenantId;

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const { number } = await this.numberingRangesService.reserveNextNumber(tenantId, input.prefix);

    const debitNote = this.debitNoteRepo.create({
      tenantId,
      invoiceId,
      number,
      issueDate: new Date(input.issueDate),
      reasonCode: input.reasonCode,
      totalAmount: input.totalAmount,
      status: 'pending',
    });
    const saved = await this.debitNoteRepo.save(debitNote);

    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('DebitNote', {
        xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2',
        'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
      })
      .ele('cbc:ID').txt(number).up()
      .ele('cbc:IssueDate').txt(input.issueDate).up()
      .ele('cbc:DebitNoteTypeCode').txt(input.reasonCode).up()
      .ele('cac:LegalMonetaryTotal')
      .ele('cbc:PayableAmount', { currencyID: 'COP' }).txt(input.totalAmount.toFixed(2)).up()
      .up();
    const xmlContent = doc.end({ prettyPrint: true });

    const xmlDir = path.join(this.storagePath, 'xml', tenantId);
    await fs.mkdir(xmlDir, { recursive: true });
    const xmlPath = path.join(xmlDir, `nd_${number.replace(/\s/g, '_')}.xml`);
    await fs.writeFile(xmlPath, xmlContent, 'utf-8');

    const cert = await this.certRepo.findOne({ where: { tenantId, isActive: true } });
    if (cert) {
      const { pfxBuffer, password } = await this.certificatesService.getDecryptedPfx(cert.id, tenantId);
      const pfxTempPath = path.join(xmlDir, `temp_${uuidv4()}.p12`);
      await fs.writeFile(pfxTempPath, pfxBuffer);
      const { signedXml } = await this.signingService.signXml(xmlContent, pfxTempPath, password);
      await fs.unlink(pfxTempPath);

      const signedXmlPath = path.join(xmlDir, `signed_nd_${number.replace(/\s/g, '_')}.xml`);
      await fs.writeFile(signedXmlPath, signedXml, 'utf-8');
      await this.debitNoteRepo.update(saved.id, { signedXmlPath, xmlPath });
    }

    return this.debitNoteRepo.findOne({ where: { id: saved.id } }) as Promise<DebitNote>;
  }
}
