import { Entity, Column, ManyToOne, JoinColumn, Unique } from "typeorm";
import { TenantEntity } from "./base.entity";
import { Invoice } from "./invoice.entity";
import { Tenant } from "./tenant.entity";

@Entity("credit_notes")
@Unique("uq_credit_notes_tenant_idempotency", ["tenant", "idempotencyKey"])
export class CreditNote extends TenantEntity {
  @Column({ type: "uuid", name: "invoice_id" })
  invoiceId: string;

  @Column({ type: "varchar", length: 30 })
  number: string;

  @Column({ type: "date", name: "issue_date" })
  issueDate: Date;

  @Column({ type: "varchar", length: 10, name: "reason_code" })
  reasonCode: string;

  @Column({ type: "decimal", precision: 20, scale: 2, name: "total_amount" })
  totalAmount: number;

  @Column({ type: "varchar", length: 50, default: "draft" })
  status: string;

  @Column({ type: "varchar", length: 96, nullable: true })
  cufe: string;

  @Column({ type: "text", nullable: true, name: "xml_path" })
  xmlPath: string;

  @Column({ type: "text", nullable: true, name: "signed_xml_path" })
  signedXmlPath: string;

  @Column({ type: "uuid", name: "idempotency_key", nullable: true })
  idempotencyKey: string;

  @Column({ type: "varchar", length: 64, name: "request_payload_hash", nullable: true })
  requestPayloadHash: string;

  @Column({ type: "jsonb", name: "response_snapshot", nullable: true })
  responseSnapshot: any;

  @Column({ type: "int", name: "response_status_code", nullable: true })
  responseStatusCode: number;

  @Column({ type: "timestamp", name: "expires_at", nullable: true })
  expiresAt: Date;

  @ManyToOne(() => Invoice)
  @JoinColumn({ name: "invoice_id" })
  invoice: Invoice;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;
}
