import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { TenantEntity } from "./base.entity";
import type { Invoice } from "./invoice.entity";
import type { Tenant } from "./tenant.entity";

@Entity("dian_submissions")
export class DianSubmission extends TenantEntity {
  @Column({ type: "uuid", name: "invoice_id" })
  invoiceId: string;

  @Column({ type: "varchar", length: 20, name: "document_type" })
  documentType: string;

  @Column({ type: "int", name: "attempt_number", default: 1 })
  attemptNumber: number;

  @Column({ type: "varchar", length: 50, default: "pending" })
  status: string;

  @Column({ type: "varchar", length: 100, nullable: true, name: "track_id" })
  trackId: string;

  @Column({ type: "text", nullable: true, name: "request_zip_path" })
  requestZipPath: string;

  @Column({ type: "text", nullable: true, name: "response_zip_path" })
  responseZipPath: string;

  @Column({ type: "text", nullable: true, name: "response_message" })
  responseMessage: string;

  @Column({
    type: "varchar",
    length: 100,
    nullable: true,
    name: "response_cufe",
  })
  responseCufe: string;

  @Column({ type: "timestamptz", nullable: true, name: "submitted_at" })
  submittedAt: Date;

  @Column({ type: "timestamptz", nullable: true, name: "responded_at" })
  respondedAt: Date;

  @ManyToOne("Invoice")
  @JoinColumn({ name: "invoice_id" })
  invoice: Invoice;

  @ManyToOne("Tenant")
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;
}
