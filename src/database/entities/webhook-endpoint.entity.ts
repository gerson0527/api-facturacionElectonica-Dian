import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { TenantEntity } from "./base.entity";
import type { Tenant } from "./tenant.entity";
import type { WebhookDelivery } from "./webhook-delivery.entity";

@Entity("webhook_endpoints")
export class WebhookEndpoint extends TenantEntity {
  @Column({ type: "varchar", length: 500 })
  url: string;

  @Column({ type: "varchar", length: 200 })
  secret: string; // Used to sign the HMAC-SHA256 payload

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "jsonb", nullable: true })
  subscribedEvents: string[]; // e.g. ["invoice.accepted", "invoice.rejected"]

  @ManyToOne("Tenant", "webhookEndpoints")
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;

  @OneToMany("WebhookDelivery", (d: WebhookDelivery) => d.endpoint)
  deliveries: WebhookDelivery[];
}
