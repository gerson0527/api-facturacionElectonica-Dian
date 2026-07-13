import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from "@nestjs/bullmq";
import { Queue, Job } from "bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DianSubmission } from "@/database/entities/dian-submission.entity";
import { Invoice } from "@/database/entities/invoice.entity";
import { DianSoapClient } from "@/services/dian-soap.client";
import { PdfQrService } from "@/services/pdf-qr.service";
import { ConfigService } from "@nestjs/config";
import { TenantRlsService } from "@/common/database/tenant-rls.service";
import * as fs from "fs/promises";
import * as path from "path";
import { DianResponseService } from "@/services/dian-response.service";

@Injectable()
@Processor("dian-status")
export class DianStatusProcessor extends WorkerHost {
  private readonly logger = new Logger(DianStatusProcessor.name);

  constructor(
    @InjectRepository(DianSubmission)
    private readonly submissionRepo: Repository<DianSubmission>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    private readonly dianSoapClient: DianSoapClient,
    private readonly pdfQrService: PdfQrService,
    private readonly configService: ConfigService,
    private readonly tenantRls: TenantRlsService,
    private readonly dianResponseService: DianResponseService,
    @InjectQueue("mailer") private readonly mailerQueue: Queue,
    @InjectQueue("webhooks") private readonly webhooksQueue: Queue,
  ) {
    super();
  }

  async process(
    job: Job<{
      trackId: string;
      submissionId: string;
      invoiceId: string;
      tenantId: string;
    }>,
  ): Promise<any> {
    const { trackId, submissionId, invoiceId, tenantId } = job.data;
    await this.tenantRls.setSessionTenant(tenantId);
    this.logger.log(`Checking DIAN status for trackId: ${trackId}`);

    try {
      const statusResponse = await this.dianSoapClient.getStatus(trackId);
      const statusCode = statusResponse.StatusCode;

      if (statusCode === "00" || statusCode === "0") {
        this.logger.log(`Invoice ${invoiceId} accepted by DIAN`);

        await this.submissionRepo.update(submissionId, {
          status: "accepted",
          responseMessage: statusResponse.StatusDescription,
          responseCufe: "",
          respondedAt: new Date(),
        });

        await this.invoiceRepo.update(invoiceId, { status: "accepted" });

        if (statusResponse.XmlBytes) {
          const storagePath =
            this.configService.get<string>("STORAGE_PATH") || "./storage";
          const dianDir = path.join(storagePath, "dian", job.data.tenantId);
          await fs.mkdir(dianDir, { recursive: true });
          const xmlBuffer = Buffer.from(statusResponse.XmlBytes, "base64");
          const xmlString = xmlBuffer.toString("utf8");

          const parsedResponse = this.dianResponseService.parseApplicationResponse(xmlString);

          const responsePath = path.join(dianDir, `response_${trackId}.xml`);
          await fs.writeFile(responsePath, xmlBuffer);

          if (!parsedResponse.isAccepted) {
            this.logger.warn(`Invoice ${invoiceId} parsed as rejected by ApplicationResponse`);
            await this.submissionRepo.update(submissionId, {
              status: "rejected",
              responseMessage: `Validation Rules Failed: ${parsedResponse.validationRules.map(r => r.ruleId).join(", ")}`,
              respondedAt: new Date(),
            });
            await this.invoiceRepo.update(invoiceId, { status: "rejected" });
            return;
          }

          await this.invoiceRepo.update(invoiceId, {
            dianResponsePath: responsePath,
          });

          this.logger.log(`Queueing email delivery for invoice ${invoiceId}`);
          await this.mailerQueue.add("send-email", { invoiceId, tenantId });

          this.logger.log(`Dispatching webhook event invoice.accepted for ${invoiceId}`);
          const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
          await this.webhooksQueue.add("dispatch-webhook", {
            tenantId,
            event: "invoice.accepted",
            invoiceId,
            payload: { invoiceId, status: "accepted", cufe: invoice?.cufe }
          });
        }
      } else if (statusCode === "01" || statusCode === "1") {
        this.logger.log(`Invoice ${invoiceId} still pending, will retry`);
        await this.submissionRepo.update(submissionId, {
          status: "pending",
          responseMessage: `Status: ${statusCode} - ${statusResponse.StatusDescription}`,
        });
        throw new Error("Pending - will retry");
      } else {
        this.logger.warn(
          `Invoice ${invoiceId} rejected: ${statusCode} - ${statusResponse.StatusDescription}`,
        );
        await this.submissionRepo.update(submissionId, {
          status: "rejected",
          responseMessage: `Código: ${statusCode} - ${statusResponse.StatusDescription}`,
          respondedAt: new Date(),
        });
        await this.invoiceRepo.update(invoiceId, { status: "rejected" });

        this.logger.log(`Dispatching webhook event invoice.rejected for ${invoiceId}`);
        await this.webhooksQueue.add("dispatch-webhook", {
          tenantId,
          event: "invoice.rejected",
          invoiceId,
          payload: { invoiceId, status: "rejected", reason: statusResponse.StatusDescription }
        });
      }
    } catch (err) {
      if ((err as Error).message.includes("Pending")) {
        throw err;
      }
      this.logger.error(`Status check error: ${(err as Error).message}`);
      await this.submissionRepo.update(submissionId, {
        status: "failed",
        responseMessage: (err as Error).message,
      });
      throw err;
    }
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job) {
    this.logger.log(`Status job ${job.id} completed`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job, err: Error) {
    this.logger.error(`Status job ${job.id} failed: ${err.message}`);
  }
}
