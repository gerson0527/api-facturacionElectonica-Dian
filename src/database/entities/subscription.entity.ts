import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { TenantEntity } from "./base.entity";
import { Plan } from "./plan.entity";

@Entity("subscriptions")
@Index("uq_subscriptions_tenant", ["tenantId"], { unique: true })
@Index("ix_subscriptions_status", ["status"])
export class Subscription extends TenantEntity {
  @ManyToOne(() => Plan, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "plan_id" })
  plan: Plan;

  @Column("uuid", { name: "plan_id" })
  planId: string;

  @Column("varchar", { length: 20, default: "trialing" })
  status: "trialing" | "active" | "past_due" | "canceled" | "suspended";

  @Column("varchar", { length: 20, default: "monthly" })
  period: "monthly" | "yearly";

  @Column("timestamptz", { nullable: true, name: "trial_ends_at" })
  trialEndsAt: Date;

  @Column("timestamptz", { nullable: true, name: "current_period_start" })
  currentPeriodStart: Date;

  @Column("timestamptz", { nullable: true, name: "current_period_end" })
  currentPeriodEnd: Date;

  @Column("timestamptz", { nullable: true, name: "canceled_at" })
  canceledAt: Date;

  @Column("varchar", { length: 100, nullable: true, name: "mp_preapproval_id" })
  mpPreapprovalId: string;

  @Column("varchar", { length: 100, nullable: true, name: "mp_customer_id" })
  mpCustomerId: string;
}
