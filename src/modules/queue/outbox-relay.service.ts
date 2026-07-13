import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ConfigService } from "@nestjs/config";
import { OutboxEvent } from "@/database/entities/outbox-event.entity";
import { Invoice } from "@/database/entities/invoice.entity";
import { DianSubmission } from "@/database/entities/dian-submission.entity";

@Injectable()
export class OutboxRelayService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OutboxRelayService.name);
  private isProcessing = false;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
    @InjectRepository(DianSubmission)
    private readonly submissionRepo: Repository<DianSubmission>,
    @InjectQueue("dian-submission") private submissionQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  onApplicationBootstrap() {
    this.logger.log("OutboxRelayService initialized");
  }

  // Poll the database every 10 seconds for pending events
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processOutbox() {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    try {
      // Find up to 100 pending events
      const events = await this.outboxRepo.find({
        where: { status: "pending" },
        take: 100,
        order: { createdAt: "ASC" },
      });

      if (events.length === 0) {
        return;
      }

      this.logger.log(`Processing ${events.length} pending outbox events`);

      for (const event of events) {
        try {
          await this.processEvent(event);
        } catch (error: any) {
          this.logger.error(
            `Failed to process outbox event ${event.id}: ${error.message}`,
          );
          // Don't throw, continue with other events
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processEvent(event: OutboxEvent) {
    if (
      event.eventType === "INVOICE_CREATED" ||
      event.eventType === "CREDIT_NOTE_CREATED" ||
      event.eventType === "DEBIT_NOTE_CREATED"
    ) {
      // We need to enqueue a job to process this submission
      // But we need the DIAN submission ID.
      // In the current implementation, DianSubmission is created alongside the invoice.
      const submission = await this.submissionRepo.findOne({
        where: { invoiceId: event.aggregateId, attemptNumber: 1 },
      });

      if (!submission) {
        // If the submission is not yet available, maybe transaction hasn't committed?
        // Let it retry on the next tick.
        return;
      }

      const jobId = `dian-submission:${event.aggregateId}:${event.id}`;

      await this.submissionQueue.add(
        "dian-submission",
        {
          submissionId: submission.id,
          invoiceId: event.aggregateId,
          tenantId: event.tenantId,
          zipPath: submission.requestZipPath,
          eventId: event.id,
        },
        {
          jobId, // Deterministic job ID to avoid duplicate processing in BullMQ
          attempts:
            this.configService.get<number>("QUEUE_SUBMISSION_MAX_ATTEMPTS") || 5,
          backoff: { type: "exponential", delay: 30000 },
        },
      );

      this.logger.log(`Enqueued job ${jobId} for event ${event.id}`);

      // Mark event as processed
      await this.outboxRepo.update(event.id, {
        status: "processed",
        processedAt: new Date(),
      });
    } else {
      // Unknown event type
      this.logger.warn(`Unknown event type: ${event.eventType}`);
      await this.outboxRepo.update(event.id, {
        status: "failed",
        error: `Unknown event type: ${event.eventType}`,
        processedAt: new Date(),
      });
    }
  }
}
