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
import { NumberingRangesService } from '../numbering-ranges/numbering-ranges.service';
import { SoftwareCredentialsService } from '../software-credentials/software-credentials.service';
import { CertificatesService } from '../certificates/certificates.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as archiver from 'archiver';
import { createWriteStream } from 'fs';
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

    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('DebitNote', {
        xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2',
        'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
        'xmlns:sts': 'dian:gov:co:facturaelectronica:Structures-2-1',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      })
      .ele('ext:UBLExtensions')
      .ele('ext:UBLExtension')
      .ele('ext:ExtensionContent')
      .ele('sts:DianExtensions')
      .ele('sts:SoftwareID').txt(softwareCreds.softwareId).up()
      .ele('sts:SoftwareSecurityCode', {
        schemeID: softwareCreds.softwareId,
        schemeName: 'software_sec',
        schemeAgencyID: '195',
      }).txt(cufe).up()
      .ele('sts:AuthorizationProviderID', {
        schemeID: '4',
        schemeName: '31',
        schemeAgencyID: '195',
      }).txt(tenant.nit).up()
      .up()
      .up()
      .up()
      .ele('ext:UBLExtension')
      .ele('ext:ExtensionContent')
      .ele('ds:Signature', {
        'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
        Id: 'nota-debito',
      })
      .up()
      .up()
      .up()
      .up()
      .ele('cbc:UBLVersionID').txt('UBL 2.1').up()
      .ele('cbc:CustomizationID').txt('10').up()
      .ele('cbc:ProfileID').txt('DIAN 1.0').up()
      .ele('cbc:ProfileExecutionID').txt(tenant.environment === 'habilitacion' ? '1' : '2').up()
      .ele('cbc:ID').txt(number).up()
      .ele('cbc:UUID', { schemeID: '2', schemeName: 'CUFE-SHA384' }).txt(cufe).up()
      .ele('cbc:IssueDate').txt(input.issueDate).up()
      .ele('cbc:IssueTime').txt(issueDate.toISOString().split('T')[1]?.split('.')[0] || '00:00:00').up()
      .ele('cbc:DebitNoteTypeCode', {
        listID: input.reasonCode,
        listAgencyID: '6',
        listName: 'Tipo Nota Débito',
      }).txt(input.reasonCode).up()
      .ele('cbc:Note').txt(input.description || `Nota débito de la factura ${invoice.number}`).up()
      .ele('cbc:DocumentCurrencyCode', {
        listID: 'ISO 4217 Alpha',
        listAgencyID: '6',
      }).txt('COP').up()
      .ele('cbc:LineCountNumeric').txt('1').up()
      .ele('cac:DiscrepancyResponse')
      .ele('cbc:ReferenceID').txt(invoice.number).up()
      .ele('cbc:ResponseCode', {
        listID: 'DIAN-ResponseCode',
        listAgencyID: '195',
      }).txt(input.reasonCode).up()
      .ele('cbc:Description').txt(input.description || 'Ajuste débito').up()
      .up()
      .ele('cac:BillingReference')
      .ele('cac:InvoiceDocumentReference')
      .ele('cbc:ID').txt(invoice.number).up()
      .ele('cbc:UUID', { schemeID: '2', schemeName: 'CUFE-SHA384' }).txt(invoice.cufe || '').up()
      .ele('cbc:IssueDate').txt(invoice.issueDate.toISOString().split('T')[0]).up()
      .up()
      .up()
      .ele('cac:AccountingSupplierParty')
      .ele('cbc:AdditionalAccountID', { schemeID: '1', schemeAgencyID: '195' }).txt('31').up()
      .ele('cac:Party')
      .ele('cac:PartyIdentification')
      .ele('cbc:ID', { schemeID: '31', schemeAgencyID: '195' }).txt(tenant.nit).up().up()
      .ele('cac:PartyName')
      .ele('cbc:Name').txt(tenant.name).up().up()
      .ele('cac:PartyLegalEntity')
      .ele('cbc:RegistrationName').txt(tenant.name).up()
      .ele('cbc:CompanyID', { schemeID: '31', schemeAgencyID: '195' }).txt(tenant.nit).up()
      .up()
      .up()
      .up()
      .ele('cac:AccountingCustomerParty')
      .ele('cbc:AdditionalAccountID', { schemeID: '1', schemeAgencyID: '195' }).txt(invoice.customerDocumentType).up()
      .ele('cac:Party')
      .ele('cac:PartyIdentification')
      .ele('cbc:ID', { schemeID: invoice.customerDocumentType, schemeAgencyID: '195' }).txt(invoice.customerDocument).up().up()
      .ele('cac:PartyName')
      .ele('cbc:Name').txt(invoice.customerName).up().up()
      .ele('cac:PartyLegalEntity')
      .ele('cbc:RegistrationName').txt(invoice.customerName).up()
      .ele('cbc:CompanyID', { schemeID: invoice.customerDocumentType, schemeAgencyID: '195' }).txt(invoice.customerDocument).up()
      .up()
      .up()
      .up()
      .ele('cac:TaxTotal')
      .ele('cbc:TaxAmount', { currencyID: 'COP' }).txt('0.00').up()
      .ele('cac:TaxSubtotal')
      .ele('cbc:TaxableAmount', { currencyID: 'COP' }).txt('0.00').up()
      .ele('cbc:TaxAmount', { currencyID: 'COP' }).txt('0.00').up()
      .ele('cac:TaxCategory')
      .ele('cbc:ID', { schemeID: '6', schemeAgencyID: '195' }).txt('01').up()
      .ele('cbc:Percent').txt('0.00').up()
      .ele('cac:TaxScheme')
      .ele('cbc:ID', { schemeID: '6', schemeAgencyID: '195' }).txt('01').up()
      .up()
      .up()
      .up()
      .up()
      .ele('cac:LegalMonetaryTotal')
      .ele('cbc:LineExtensionAmount', { currencyID: 'COP' }).txt(input.totalAmount.toFixed(2)).up()
      .ele('cbc:TaxExclusiveAmount', { currencyID: 'COP' }).txt(input.totalAmount.toFixed(2)).up()
      .ele('cbc:TaxInclusiveAmount', { currencyID: 'COP' }).txt(input.totalAmount.toFixed(2)).up()
      .ele('cbc:PayableAmount', { currencyID: 'COP' }).txt(input.totalAmount.toFixed(2)).up()
      .up()
      .ele('cac:DebitNoteLine')
      .ele('cbc:ID').txt('1').up()
      .ele('cbc:DebitedQuantity', { unitCode: '94', unitCodeListID: 'UN/ECE 20' }).txt('1').up()
      .ele('cbc:LineExtensionAmount', { currencyID: 'COP' }).txt(input.totalAmount.toFixed(2)).up()
      .ele('cac:Item')
      .ele('cbc:Description').txt(input.description || 'Nota débito').up()
      .up()
      .ele('cac:Price')
      .ele('cbc:PriceAmount', { currencyID: 'COP' }).txt(input.totalAmount.toFixed(2)).up()
      .up()
      .up();
    const xmlContent = doc.end({ prettyPrint: true });

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
        archive.append(signedXml, { name: 'fa.xml' });
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
