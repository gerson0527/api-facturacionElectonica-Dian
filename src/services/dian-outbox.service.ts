import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DianSubmission } from '@/database/entities/dian-submission.entity';
import { DianSoapClient } from './dian-soap.client';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';

export interface OutboxCreateInput {
  invoiceId: string;
  documentType: string;
  tenantId: string;
}

export interface OutboxSubmitResult {
  success: boolean;
  trackId?: string;
  errorMessage?: string;
}

@Injectable()
export class DianOutboxService {
  private readonly logger = new Logger(DianOutboxService.name);
  private readonly maxRetries: number;
  private readonly baseDelay: number;

  constructor(
    @InjectRepository(DianSubmission)
    private readonly submissionRepo: Repository<DianSubmission>,
    private readonly soapClient: DianSoapClient,
    private readonly storage: StorageService,
    private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    this.maxRetries = configService.get<number>('DIAN_MAX_RETRIES') || 3;
    this.baseDelay = configService.get<number>('DIAN_RETRY_BASE_DELAY') || 5000;
  }

  async create(input: OutboxCreateInput): Promise<DianSubmission> {
    const submission = this.submissionRepo.create({
      invoiceId: input.invoiceId,
      documentType: input.documentType,
      tenantId: input.tenantId,
      status: 'pending',
    });
    return this.submissionRepo.save(submission);
  }

  async submit(submissionId: string, fileName: string, signedXml: string): Promise<OutboxSubmitResult> {
    const submission = await this.submissionRepo.findOne({ where: { id: submissionId } });
    if (!submission) {
      return { success: false, errorMessage: 'Submission not found' };
    }
    return this.executeWithRetry(submission, fileName, signedXml);
  }

  private async executeWithRetry(
    submission: DianSubmission,
    fileName: string,
    signedXml: string,
  ): Promise<OutboxSubmitResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const locked = await queryRunner.manager.findOne(DianSubmission, {
        where: { id: submission.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!locked || locked.status === 'success') {
        return { success: true, trackId: locked?.responseCufe };
      }

      const contentBase64 = Buffer.from(signedXml, 'utf8').toString('base64');
      const zipContent = await this.createZip(contentBase64);
      const zipFileName = `${fileName.replace('.xml', '')}.zip`;
      await this.storage.save(submission.tenantId, 'dian-response', `request-${submission.id}.zip`, zipContent);

      locked.requestZipPath = this.storage.getFullPath(submission.tenantId, 'dian-response', `request-${submission.id}.zip`);
      locked.status = 'sending';
      locked.submittedAt = new Date();
      await queryRunner.manager.save(locked);

      const response = await this.soapClient.sendBillAsync(zipFileName, zipContent.toString('base64'));
      const trackId = response.TrackId;

      locked.trackId = trackId;
      locked.status = 'sent';
      locked.attemptNumber = (locked.attemptNumber || 0) + 1;
      await queryRunner.manager.save(locked);
      await queryRunner.commitTransaction();

      return { success: true, trackId };
    } catch (err) {
      await queryRunner.rollbackTransaction();

      const attemptNumber = (submission.attemptNumber || 0) + 1;
      if (attemptNumber < this.maxRetries) {
        const delay = this.baseDelay * Math.pow(2, attemptNumber - 1);
        this.logger.warn(`Intento ${attemptNumber}/${this.maxRetries} falló. Reintentando en ${delay}ms...`);
        await this.submissionRepo.update(submission.id, {
          status: 'retrying',
          attemptNumber,
          responseMessage: (err as Error).message,
        });
        await this.sleep(delay);
        return this.executeWithRetry(submission, fileName, signedXml);
      }

      await this.submissionRepo.update(submission.id, {
        status: 'failed',
        attemptNumber,
        responseMessage: (err as Error).message,
        respondedAt: new Date(),
      });
      return { success: false, errorMessage: (err as Error).message };
    } finally {
      await queryRunner.release();
    }
  }

  async pollStatus(submissionId: string): Promise<void> {
    const submission = await this.submissionRepo.findOne({ where: { id: submissionId } });
    if (!submission || !submission.trackId || submission.status === 'success') {
      return;
    }

    try {
      const response = await this.soapClient.getStatus(submission.trackId);
      if (response.StatusCode === '00') {
        submission.status = 'success';
        submission.responseCufe = this.extractCufeFromResponse(response.XmlBytes);
        submission.responseMessage = response.StatusDescription;
        submission.respondedAt = new Date();

        if (response.XmlBytes) {
          await this.storage.save(submission.tenantId, 'dian-response', `response-${submission.id}.zip`, response.XmlBytes);
          submission.responseZipPath = this.storage.getFullPath(submission.tenantId, 'dian-response', `response-${submission.id}.zip`);
        }
      } else {
        submission.status = 'failed';
        submission.responseMessage = response.StatusDescription;
        submission.respondedAt = new Date();
      }
      await this.submissionRepo.save(submission);
    } catch (err) {
      this.logger.error(`Error polling status: ${(err as Error).message}`);
    }
  }

  private createZip(contentBase64: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archiver = require('archiver');
      const buffers: Buffer[] = [];
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('data', (d: Buffer) => buffers.push(d));
      archive.on('end', () => resolve(Buffer.concat(buffers)));
      archive.on('error', reject);
      archive.append(Buffer.from(contentBase64, 'base64'), { name: 'content.xml' });
      archive.finalize();
    });
  }

  private extractCufeFromResponse(xmlBytesBase64: string): string {
    if (!xmlBytesBase64) return '';
    try {
      const xml = Buffer.from(xmlBytesBase64, 'base64').toString('utf8');
      const match = xml.match(/<cuf[eé]>([^<]+)<\/cuf[eé]>/i);
      return match ? match[1] : '';
    } catch {
      return '';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
