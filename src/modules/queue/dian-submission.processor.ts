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
import { ConfigService } from "@nestjs/config";
import { TenantRlsService } from "@/common/database/tenant-rls.service";
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
      const response = await this.dianSoapClient.sendBillAsync(
        fileName,
        contentFileBase64,
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
      if (job.data && job.data.eventId) {
        try {
          const { OutboxEvent } = require("@/database/entities/outbox-event.entity");
          await this.submissionRepo.manager.update(OutboxEvent, job.data.eventId, {
            status: "failed",
            error: err.message,
          });
          this.logger.log(`OutboxEvent ${job.data.eventId} marked as failed (DLQ)`);
        } catch (e: any) {
          this.logger.error(`Failed to update OutboxEvent for DLQ: ${e.message}`);
        }
      }
    }
  }
}
