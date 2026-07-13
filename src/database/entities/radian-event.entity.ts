import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { TenantEntity } from "./base.entity";
import type { Invoice } from "./invoice.entity";
import type { Tenant } from "./tenant.entity";

@Entity("radian_events")
export class RadianEvent extends TenantEntity {
  @Column({ type: "uuid", name: "invoice_id" })
  invoiceId: string;

  @Column({ type: "varchar", length: 10, name: "event_code" })
  eventCode: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  cude: string;

  @Column({ type: "varchar", length: 50, default: "pending" })
  status: string; // pending, submitted, accepted, rejected

  @Column({ type: "varchar", length: 100, nullable: true, name: "track_id" })
  trackId: string;

  @Column({ type: "text", nullable: true, name: "response_message" })
  responseMessage: string;

  @Column({ type: "text", nullable: true, name: "xml_path" })
  xmlPath: string;

  @Column({ type: "text", nullable: true, name: "dian_response_path" })
  dianResponsePath: string;

  @ManyToOne("Invoice")
  @JoinColumn({ name: "invoice_id" })
  invoice: Invoice;

  @ManyToOne("Tenant")
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;
}
