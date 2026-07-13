import { Module, OnModuleInit, Logger } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";

import { OutboxRelayService } from "./outbox-relay.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OutboxEvent } from "@/database/entities/outbox-event.entity";
import { DianSubmission } from "@/database/entities/dian-submission.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEvent, DianSubmission]),
    BullModule.registerQueue(
      { name: "dian-submission" },
      { name: "dian-status" },
      { name: "mailer" },
    ),
  ],
  providers: [OutboxRelayService],
  exports: [OutboxRelayService],
})
export class QueueModule implements OnModuleInit {
  private readonly logger = new Logger(QueueModule.name);

  async onModuleInit() {
    this.logger.log("BullMQ queues initialized: dian-submission, dian-status");
  }
}
