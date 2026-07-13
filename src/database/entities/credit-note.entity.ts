import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { TenantEntity } from "./base.entity";
import { Invoice } from "./invoice.entity";
import { Tenant } from "./tenant.entity";

@Entity("credit_notes")
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

  @ManyToOne(() => Invoice)
  @JoinColumn({ name: "invoice_id" })
  invoice: Invoice;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;
}
