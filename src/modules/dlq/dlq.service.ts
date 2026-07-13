import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DianDlq } from "@/database/entities/dian-dlq.entity";
import { OutboxEvent } from "@/database/entities/outbox-event.entity";

@Injectable()
export class DlqService {
  constructor(
    @InjectRepository(DianDlq)
    private readonly dlqRepo: Repository<DianDlq>,
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
  ) {}

  async getPendingDlq(tenantId: string): Promise<DianDlq[]> {
    return this.dlqRepo.find({
      where: { tenant: { id: tenantId }, status: "pending" },
      order: { createdAt: "ASC" },
      relations: ["invoice"],
    });
  }

  async retryDlqItem(tenantId: string, dlqId: string): Promise<void> {
    const dlqItem = await this.dlqRepo.findOne({
      where: { id: dlqId, tenant: { id: tenantId }, status: "pending" },
      relations: ["invoice"],
    });

    if (!dlqItem) {
      throw new NotFoundException("DLQ item not found or already resolved");
    }

    // Recreate an OutboxEvent
    const outboxEvent = this.outboxRepo.create({
      aggregateType: "invoice",
      aggregateId: dlqItem.invoice.id,
      eventType: "invoice.created",
      payload: dlqItem.payload,
      status: "pending",
      tenantId: tenantId,
    });
    await this.outboxRepo.save(outboxEvent);

    dlqItem.status = "resolved";
    await this.dlqRepo.save(dlqItem);
  }

  async retryAllDlq(tenantId: string): Promise<{ retried: number }> {
    const dlqItems = await this.getPendingDlq(tenantId);
    let count = 0;
    for (const item of dlqItems) {
      await this.retryDlqItem(tenantId, item.id);
      count++;
    }
    return { retried: count };
  }
}
