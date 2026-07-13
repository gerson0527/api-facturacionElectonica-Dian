import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { DianDlq } from "@/database/entities/dian-dlq.entity";
import { DlqService } from "./dlq.service";
import { DlqController } from "./dlq.controller";
import { OutboxEvent } from "@/database/entities/outbox-event.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([DianDlq, OutboxEvent]),
  ],
  controllers: [DlqController],
  providers: [DlqService],
  exports: [DlqService],
})
export class DlqModule {}
