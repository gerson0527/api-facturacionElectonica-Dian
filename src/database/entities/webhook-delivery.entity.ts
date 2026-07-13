import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { TenantEntity } from "./base.entity";
import type { Tenant } from "./tenant.entity";
import type { WebhookEndpoint } from "./webhook-endpoint.entity";

@Entity("webhook_deliveries")
export class WebhookDelivery extends TenantEntity {
  @Column({ type: "varchar", length: 100 })
  event: string;

  @Column({ type: "jsonb" })
  payload: any;

  @Column({ type: "int", nullable: true, name: "status_code" })
  statusCode: number;

  @Column({ type: "int", nullable: true, name: "response_time_ms" })
  responseTimeMs: number;

  @Column({ type: "text", nullable: true, name: "response_body" })
  responseBody: string;

  @Column({ type: "varchar", length: 50, default: "pending" })
  status: string; // pending, success, failed

  @Column({ type: "int", default: 0 })
  attempts: number;

  @Column({ type: "uuid", nullable: true, name: "invoice_id" })
  invoiceId: string; // Optional reference

  @ManyToOne("WebhookEndpoint", "deliveries", { onDelete: "CASCADE" })
  @JoinColumn({ name: "endpoint_id" })
  endpoint: WebhookEndpoint;

  @ManyToOne("Tenant")
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;
}
