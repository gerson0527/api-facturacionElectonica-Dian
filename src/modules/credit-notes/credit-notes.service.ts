import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { CreditNote } from '@/database/entities/credit-note.entity';
import { Invoice } from '@/database/entities/invoice.entity';
import { DianSoftwareCredential } from '@/database/entities/dian-software-credential.entity';
import { DigitalCertificate } from '@/database/entities/digital-certificate.entity';
import { DianSubmission } from '@/database/entities/dian-submission.entity';
import { Tenant } from '@/database/entities/tenant.entity';
import { CufeService } from '@/services/cufe.service';
import { XmlBuilderService } from '@/services/xml-builder.service';
import { SigningService } from '@/services/signing.service';
import { NumberingRangesService } from '../numbering-ranges/numbering-ranges.service';
import { SoftwareCredentialsService } from '../software-credentials/software-credentials.service';
import { CertificatesService } from '../certificates/certificates.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { create } from 'xmlbuilder2';

@Injectable()
export class CreditNotesService {
  private readonly logger = new Logger(CreditNotesService.name);
  private readonly storagePath: string;

  constructor(
    @InjectRepository(CreditNote)
    private readonly creditNoteRepo: Repository<CreditNote>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
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
    private readonly xmlBuilderService: XmlBuilderService,
    private readonly signingService: SigningService,
    private readonly numberingRangesService: NumberingRangesService,
    private readonly softwareCredentialsService: SoftwareCredentialsService,
    private readonly certificatesService: CertificatesService,
  ) {
    this.storagePath = this.configService.get<string>('STORAGE_PATH') || './storage';
  }

  async create(invoiceId: string, input: { issueDate: string; reasonCode: string; totalAmount: number; prefix: string }): Promise<CreditNote> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
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
      tipoDocEmisor: '31',
      tipoDocAdquirente: invoice.customerDocumentType,
      numDocAdquirente: invoice.customerDocument,
      softwarePin,
      ambiente: tenant.environment === 'produccion' ? '2' : '1',
    };
    const cufe = this.cufeService.generate(cufeInput);

    const creditNote = this.creditNoteRepo.create({
      tenantId,
      invoiceId,
      number,
      issueDate,
      reasonCode: input.reasonCode,
      totalAmount: input.totalAmount,
      status: 'pending',
      cufe,
    });
    const saved = await this.creditNoteRepo.save(creditNote);

    // Build simple XML for credit note
    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('CreditNote', {
        xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2',
        'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
      })
      .ele('cbc:ID').txt(number).up()
      .ele('cbc:IssueDate').txt(input.issueDate).up()
      .ele('cbc:CreditNoteTypeCode').txt(input.reasonCode).up()
      .ele('cbc:Note').txt(input.reasonCode === '1' ? 'Anulación' : 'Nota Crédito').up()
      .ele('cac:DiscrepancyResponse')
      .ele('cbc:ReferenceID').txt(invoice.number).up()
      .ele('cbc:ResponseCode').txt(input.reasonCode).up()
      .up()
      .ele('cac:BillingReference')
      .ele('cac:InvoiceDocumentReference')
      .ele('cbc:ID').txt(invoice.number).up()
      .up()
      .up()
      .ele('cac:LegalMonetaryTotal')
      .ele('cbc:PayableAmount', { currencyID: 'COP' }).txt(input.totalAmount.toFixed(2)).up()
      .up();
    const xmlContent = doc.end({ prettyPrint: true });

    const xmlDir = path.join(this.storagePath, 'xml', tenantId);
    await fs.mkdir(xmlDir, { recursive: true });
    const xmlPath = path.join(xmlDir, `nc_${number.replace(/\s/g, '_')}.xml`);
    await fs.writeFile(xmlPath, xmlContent, 'utf-8');

    // Sign
    const cert = await this.certRepo.findOne({ where: { tenantId, isActive: true } });
    if (cert) {
      const { pfxBuffer, password } = await this.certificatesService.getDecryptedPfx(cert.id, tenantId);
      const pfxTempPath = path.join(xmlDir, `temp_${uuidv4()}.p12`);
      await fs.writeFile(pfxTempPath, pfxBuffer);
      const { signedXml } = await this.signingService.signXml(xmlContent, pfxTempPath, password);
      await fs.unlink(pfxTempPath);

      const signedXmlPath = path.join(xmlDir, `signed_nc_${number.replace(/\s/g, '_')}.xml`);
      await fs.writeFile(signedXmlPath, signedXml, 'utf-8');

      const zipDir = path.join(this.storagePath, 'dian', tenantId);
      await fs.mkdir(zipDir, { recursive: true });
      const zipPath = path.join(zipDir, `nc_${number.replace(/\s/g, '_')}.zip`);
      await new Promise<void>((resolve, reject) => {
        const output = createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        output.on('close', () => resolve());
        archive.on('error', reject);
        archive.pipe(output);
        archive.append(signedXml, { name: 'fa.xml' });
        archive.finalize();
      });

      await this.creditNoteRepo.update(saved.id, { signedXmlPath, xmlPath });
    }

    return this.creditNoteRepo.findOne({ where: { id: saved.id } }) as Promise<CreditNote>;
  }
}
