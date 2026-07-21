import { Column, Entity, Index } from "typeorm";
import { TenantEntity } from "./base.entity";

@Entity("billing_events")
@Index("ix_billing_events_tenant", ["tenantId", "createdAt"])
export class BillingEvent extends TenantEntity {
  @Column("uuid", { name: "subscription_id", nullable: true })
  subscriptionId: string;

  @Column("varchar", { length: 50 })
  type:
    | "subscription.created"
    | "subscription.activated"
    | "subscription.canceled"
    | "subscription.suspended"
    | "payment.received"
    | "payment.failed"
    | "invoice.generated";

  @Column("jsonb", { nullable: true })
  payload: Record<string, any>;

  @Column("varchar", { length: 100, nullable: true, name: "mp_payment_id" })
  mpPaymentId: string;

  @Column("varchar", { length: 20, default: "pending" })
  status: "pending" | "processed" | "failed";
}
