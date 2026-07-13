import { Entity, Column, Index } from "typeorm";
import { TenantEntity } from "./base.entity";

@Entity("outbox_events")
export class OutboxEvent extends TenantEntity {
  @Index()
  @Column({ type: "varchar", length: 50 })
  aggregateType: string;

  @Index()
  @Column({ type: "uuid" })
  aggregateId: string;

  @Column({ type: "varchar", length: 100 })
  eventType: string;

  @Column({ type: "jsonb" })
  payload: any;

  @Index()
  @Column({ type: "varchar", length: 20, default: "pending" })
  status: "pending" | "processed" | "failed";

  @Column({ type: "text", nullable: true })
  error: string;

  @Column({ type: "timestamptz", nullable: true })
  processedAt: Date;
}
