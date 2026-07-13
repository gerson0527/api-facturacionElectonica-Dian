import {
  Processor,
  WorkerHost,
  OnWorkerEvent,
  InjectQueue,
} from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DianSubmission } from "@/database/entities/dian-submission.entity";
import { Invoice } from "@/database/entities/invoice.entity";
import { DianSoapClient } from "@/services/dian-soap.client";
import { DianDlq } from "@/database/entities/dian-dlq.entity";
import { OutboxEvent } from "@/database/entities/outbox-event.entity";
import { ConfigService } from "@nestjs/config";
import { TenantRlsService } from "@/common/database/tenant-rls.service";
import { CertificatesService } from "@/modules/certificates/certificates.service";
import * as fs from "fs/promises";
import * as path from "path";

@Injectable()
@Processor("dian-submission")
export class DianSubmissionProcessor extends WorkerHost {
  private readonly logger = new Logger(DianSubmissionProcessor.name);

  constructor(
    @InjectRepository(DianSubmission)
    private readonly submissionRepo: Repository<DianSubmission>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectQueue("dian-status")
    private readonly dianStatusQueue: Queue,
    private readonly dianSoapClient: DianSoapClient,
    private readonly configService: ConfigService,
    private readonly tenantRls: TenantRlsService,
    private readonly certificatesService: CertificatesService,
  ) {
    super();
  }

  async process(
    job: Job<{
      submissionId: string;
      invoiceId: string;
      tenantId: string;
      zipPath: string;
      eventId?: string;
    }>,
  ): Promise<any> {
    const { submissionId, invoiceId, tenantId, zipPath } = job.data;
    await this.tenantRls.setSessionTenant(tenantId);
    this.logger.log(
      `Processing DIAN submission ${submissionId} for invoice ${invoiceId} (attempt ${job.attemptsMade + 1})`,
    );

    try {
      await this.submissionRepo.update(submissionId, {
        status: "submitting",
        submittedAt: new Date(),
      });

      // Read ZIP and encode as base64
      const zipBuffer = await fs.readFile(zipPath);
      const contentFileBase64 = zipBuffer.toString("base64");

      const fileName = path.basename(zipPath);

      // Send to DIAN
      // We need the digital certificate to sign the SOAP message with WS-Security
      const cert = await this.submissionRepo.manager.query(
        `SELECT dc.id FROM digital_certificates dc WHERE dc.tenant_id = $1 AND dc.is_active = true LIMIT 1`,
        [tenantId]
      );
      
      if (!cert || cert.length === 0) {
        throw new Error("No active digital certificate found for tenant");
      }

      const { pfxBuffer, password } = await this.certificatesService.getDecryptedPfx(cert[0].id, tenantId);

      const response = await this.dianSoapClient.sendBillAsync(
        fileName,
        contentFileBase64,
        pfxBuffer,
        password
      );
      if (response.TrackId) {
        await this.submissionRepo.update(submissionId, {
          status: "submitted",
          responseMessage: `TrackId: ${response.TrackId}`,
          respondedAt: new Date(),
        });

        // Enqueue status check
        await this.dianStatusQueue.add(
          "dian-status",
          {
            trackId: response.TrackId,
            submissionId,
            invoiceId,
            tenantId: job.data.tenantId,
          },
          {
            attempts:
              this.configService.get<number>("QUEUE_STATUS_MAX_ATTEMPTS") || 5,
            backoff: { type: "exponential", delay: 60000 },
            delay: 10000,
          },
        );
      } else {
        const statusCode = response.StatusCode || "99";
        const statusDesc = response.StatusDescription || "Error desconocido";
        await this.submissionRepo.update(submissionId, {
          status: "rejected",
          responseMessage: `Código: ${statusCode} - ${statusDesc}`,
          respondedAt: new Date(),
        });
        await this.invoiceRepo.update(invoiceId, { status: "rejected" });
        throw new Error(`DIAN rejection: ${statusCode} - ${statusDesc}`);
      }
    } catch (err) {
      this.logger.error(`Submission error: ${(err as Error).message}`);
      await this.submissionRepo.update(submissionId, {
        status: "failed",
        responseMessage: (err as Error).message,
        respondedAt: new Date(),
      });
      throw err;
    }
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} failed: ${err.message}`);
    // If maximum attempts are reached, it's a permanent failure (DLQ equivalent)
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      let outboxPayload = null;
      if (job.data && job.data.eventId) {
        try {
          const outboxEvent = await this.submissionRepo.manager.findOne(OutboxEvent, { where: { id: job.data.eventId } });
          if (outboxEvent) {
            outboxPayload = outboxEvent.payload;
            await this.submissionRepo.manager.update(OutboxEvent, job.data.eventId, {
              status: "failed",
              error: err.message,
            });
            this.logger.log(`OutboxEvent ${job.data.eventId} marked as failed (DLQ)`);
          }
        } catch (e: any) {
          this.logger.error(`Failed to update OutboxEvent for DLQ: ${e.message}`);
        }
      }

      // Record in DianDlq
      try {
        const submission = await this.submissionRepo.findOne({ where: { id: job.data.submissionId }, relations: ["invoice", "tenant"] });
        if (submission) {
          const dlq = this.submissionRepo.manager.create(DianDlq, {
            invoice: submission.invoice,
            tenant: submission.tenant,
            payload: outboxPayload || {},
            lastError: err.message,
            status: "pending",
          });
          await this.submissionRepo.manager.save(dlq);
          this.logger.log(`Invoice ${submission.invoice.id} moved to DLQ`);
        }
      } catch (e: any) {
        this.logger.error(`Failed to save DLQ record: ${e.message}`);
      }
    }
  }
}
