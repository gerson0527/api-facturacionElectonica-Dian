import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Unique } from "typeorm";
import { TenantEntity } from "./base.entity";
import { Tenant } from "./tenant.entity";
import { Customer } from "./customer.entity";

@Entity("invoices")
@Unique("uq_invoices_tenant_idempotency", ["tenant", "idempotencyKey"])
export class Invoice extends TenantEntity {
  @Column({ type: "varchar", length: 30 })
  number: string;

  @Column({ type: "varchar", length: 5, name: "invoice_type", default: "01" })
  invoiceType: string;

  @Column({
    type: "varchar",
    length: 5,
    name: "payment_form_code",
    default: "1",
  })
  paymentFormCode: string;

  @Column({
    type: "varchar",
    length: 5,
    name: "payment_method_code",
    default: "10",
  })
  paymentMethodCode: string;

  @Column({ type: "date", name: "issue_date" })
  issueDate: Date;

  @Column({ type: "date", name: "due_date", nullable: true })
  dueDate: Date;

  @Column({ type: "uuid", name: "customer_id", nullable: true })
  customerId: string;

  @Column({ type: "varchar", length: 300, name: "customer_name" })
  customerName: string;

  @Column({ type: "varchar", length: 30, name: "customer_document" })
  customerDocument: string;

  @Column({ type: "varchar", length: 5, name: "customer_document_type" })
  customerDocumentType: string;

  @Column({ type: "decimal", precision: 20, scale: 2, default: 0 })
  subtotal: number;

  @Column({
    type: "decimal",
    precision: 20,
    scale: 2,
    default: 0,
    name: "total_tax",
  })
  totalTax: number;

  @Column({
    type: "decimal",
    precision: 20,
    scale: 2,
    default: 0,
    name: "total_amount",
  })
  totalAmount: number;

  @Column({ type: "varchar", length: 50, default: "draft" })
  status: string;

  @Column({ type: "varchar", length: 96, nullable: true })
  cufe: string;

  @Column({ type: "text", nullable: true, name: "qr_code" })
  qrCode: string;

  @Column({ type: "text", nullable: true, name: "xml_path" })
  xmlPath: string;

  @Column({ type: "text", nullable: true, name: "signed_xml_path" })
  signedXmlPath: string;

  @Column({ type: "text", nullable: true, name: "pdf_path" })
  pdfPath: string;

  @Column({ type: "text", nullable: true, name: "dian_response_path" })
  dianResponsePath: string;

  @Column({ type: "uuid", name: "idempotency_key" })
  idempotencyKey: string;

  @Column({ type: "varchar", length: 64, name: "request_payload_hash", nullable: true })
  requestPayloadHash: string;

  @Column({ type: "jsonb", name: "response_snapshot", nullable: true })
  responseSnapshot: any;

  @Column({ type: "int", name: "response_status_code", nullable: true })
  responseStatusCode: number;

  @Column({ type: "timestamp", name: "expires_at", nullable: true })
  expiresAt: Date;

  @ManyToOne(() => Tenant, (t) => t.invoices)
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: "customer_id" })
  customer: Customer;
}
