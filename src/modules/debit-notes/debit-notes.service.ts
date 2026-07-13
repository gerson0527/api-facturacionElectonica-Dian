import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { DebitNote } from '@/database/entities/debit-note.entity';
import { Invoice } from '@/database/entities/invoice.entity';
import { NumberingRange } from '@/database/entities/numbering-range.entity';
import { DianSoftwareCredential } from '@/database/entities/dian-software-credential.entity';
import { DigitalCertificate } from '@/database/entities/digital-certificate.entity';
import { DianSubmission } from '@/database/entities/dian-submission.entity';
import { Tenant } from '@/database/entities/tenant.entity';
import { CufeService } from '@/services/cufe.service';
import { SigningService } from '@/services/signing.service';
import { DianSoapClient } from '@/services/dian-soap.client';
import { XmlBuilderService, DebitNoteXmlData } from '@/services/xml-builder.service';
import { NumberingRangesService } from '../numbering-ranges/numbering-ranges.service';
import { SoftwareCredentialsService } from '../software-credentials/software-credentials.service';
import { CertificatesService } from '../certificates/certificates.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import archiver from 'archiver';
import { createWriteStream } from 'fs';

@Injectable()
export class DebitNotesService {
  private readonly logger = new Logger(DebitNotesService.name);
  private readonly storagePath: string;

  constructor(
    @InjectRepository(DebitNote)
    private readonly debitNoteRepo: Repository<DebitNote>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(NumberingRange)
    private readonly rangeRepo: Repository<NumberingRange>,
    @InjectRepository(DianSoftwareCredential)
    private readonly softwareCredRepo: Repository<DianSoftwareCredential>,
    @InjectRepository(DigitalCertificate)
    private readonly certRepo: Repository<DigitalCertificate>,
    @InjectRepository(DianSubmission)
    private readonly submissionRepo: Repository<DianSubmission>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectQueue('dian-submission') private submissionQueue: Queue,
    private readonly configService: ConfigService,
    private readonly cufeService: CufeService,
    private readonly signingService: SigningService,
    private readonly xmlBuilderService: XmlBuilderService,
    private readonly dianSoapClient: DianSoapClient,
    private readonly numberingRangesService: NumberingRangesService,
    private readonly softwareCredentialsService: SoftwareCredentialsService,
    private readonly certificatesService: CertificatesService,
  ) {
    this.storagePath = this.configService.get<string>('STORAGE_PATH') || './storage';
  }

  async create(invoiceId: string, input: { issueDate: string; reasonCode: string; totalAmount: number; prefix: string; description?: string }): Promise<DebitNote> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) {
      throw new NotFoundException('Factura original no encontrada');
    }
    const tenantId = invoice.tenantId;

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const softwareCreds = await this.softwareCredRepo.findOne({ where: { tenantId } });
    if (!softwareCreds) throw new NotFoundException('Credenciales DIAN no encontradas');
    const softwarePin = await this.softwareCredentialsService.decryptPin(softwareCreds);

    const { number } = await this.numberingRangesService.reserveNextNumber(tenantId, input.prefix);

    const issueDate = new Date(input.issueDate);
    const cufeInput = {
      numFac: number,
      fecFac: issueDate.toISOString().split('T')[0],
      horFac: issueDate.toISOString().split('T')[1]?.split('.')[0] || '00:00:00',
      valBruto: input.totalAmount.toFixed(2),
      valIva: '0.00',
      valAdicional: '0.00',
      valTotal: input.totalAmount.toFixed(2),
      nitEmisor: tenant.nit,
      dvEmisor: tenant.dv,
      tipoDocEmisor: tenant.documentType || '31',
      tipoDocAdquirente: invoice.customerDocumentType,
      numDocAdquirente: invoice.customerDocument,
      dvAdquirente: '',
      softwarePin,
      ambiente: tenant.environment === 'produccion' ? '2' : '1',
    };
    const cufe = this.cufeService.generate(cufeInput);

    const debitNote = this.debitNoteRepo.create({
      tenantId,
      invoiceId,
      number,
      issueDate,
      reasonCode: input.reasonCode,
      totalAmount: input.totalAmount,
      status: 'pending',
      cufe,
    });
    const saved = await this.debitNoteRepo.save(debitNote);

    const qrCode = `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufe}`;
    const issueTime = issueDate.toISOString().split('T')[1]?.split('.')[0] || '00:00:00';

    const debitNoteData: DebitNoteXmlData = {
      number,
      issueDate: input.issueDate,
      issueTime,
      currencyCode: 'COP',
      cufe,
      qrCode,
      softwareId: softwareCreds.softwareId,
      softwarePin,
      environment: tenant.environment,
      testSetId: softwareCreds.testSetId || '',
      issuer: {
        nit: tenant.nit,
        dv: tenant.dv,
        name: tenant.name,
        address: tenant.address || '',
        phone: tenant.phone || '',
        email: tenant.email || '',
        municipalityCode: '11001',
        fiscalResponsibilities: ['O-99'],
      },
      customer: {
        documentType: invoice.customerDocumentType,
        documentNumber: invoice.customerDocument,
        name: invoice.customerName,
        address: '',
        phone: '',
        email: '',
        municipalityCode: '11001',
        fiscalResponsibilities: ['O-99'],
      },
      taxTotals: [],
      subtotal: input.totalAmount,
      totalTax: 0,
      totalAmount: input.totalAmount,
      lines: [{
        lineNumber: 1,
        description: input.description || 'Nota débito',
        quantity: 1,
        unitCode: '94',
        unitPrice: input.totalAmount,
        lineExtensionAmount: input.totalAmount,
        taxCode: '01',
        taxPercent: 0,
        taxAmount: 0,
      }],
      noteType: input.reasonCode,
      invoiceId: invoice.cufe || invoice.number,
      invoiceNumber: invoice.number,
      reasonCode: input.reasonCode,
      description: input.description,
    };

    const xmlContent = await this.xmlBuilderService.buildDebitNoteXml(debitNoteData);

    const xmlDir = path.join(this.storagePath, 'xml', tenantId);
    await fs.mkdir(xmlDir, { recursive: true });
    const xmlPath = path.join(xmlDir, `nd_${number.replace(/[^a-zA-Z0-9]/g, '_')}.xml`);
    await fs.writeFile(xmlPath, xmlContent, 'utf-8');

    let signedXmlPath: string | undefined;
    let zipPath: string | undefined;

    const cert = await this.certRepo.findOne({ where: { tenantId, isActive: true } });
    if (cert) {
      const { pfxBuffer, password } = await this.certificatesService.getDecryptedPfx(cert.id, tenantId);
      const { signedXml } = await this.signingService.signXmlFromBuffer(xmlContent, pfxBuffer, password);

      signedXmlPath = path.join(xmlDir, `signed_nd_${number.replace(/[^a-zA-Z0-9]/g, '_')}.xml`);
      await fs.writeFile(signedXmlPath, signedXml, 'utf-8');

      const zipDir = path.join(this.storagePath, 'dian', tenantId);
      await fs.mkdir(zipDir, { recursive: true });
      zipPath = path.join(zipDir, `nd_${number.replace(/[^a-zA-Z0-9]/g, '_')}.zip`);

      await new Promise<void>((resolve, reject) => {
        const output = createWriteStream(zipPath!);
        const archive = archiver('zip', { zlib: { level: 9 } });
        output.on('close', () => resolve());
        archive.on('error', reject);
        archive.pipe(output);
        archive.append(signedXml, { name: 'nd.xml' });
        archive.finalize();
      });

      const submission = this.submissionRepo.create({
        tenantId,
        invoiceId: saved.id,
        documentType: 'debit-note',
        attemptNumber: 1,
        status: 'pending',
        requestZipPath: zipPath,
      });
      await this.submissionRepo.save(submission);

      await this.submissionQueue.add('dian-submission', {
        submissionId: submission.id,
        invoiceId: saved.id,
        tenantId,
        zipPath,
      }, {
        attempts: this.configService.get<number>('QUEUE_SUBMISSION_MAX_ATTEMPTS') || 5,
        backoff: { type: 'exponential', delay: 30000 },
      });

      this.logger.log(`Nota débito ${number} encolada para envío DIAN (submission: ${submission.id})`);
    }

    await this.debitNoteRepo.update(saved.id, { signedXmlPath: signedXmlPath || '', xmlPath });
    return this.debitNoteRepo.findOne({ where: { id: saved.id } }) as Promise<DebitNote>;
  }
}
