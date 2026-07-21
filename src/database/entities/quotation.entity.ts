import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { TenantEntity } from "./base.entity";
import { Customer } from "./customer.entity";
import type { QuotationLine } from "./quotation-line.entity";

export enum QuotationStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected'
}

@Entity("quotations")
export class Quotation extends TenantEntity {
  @Column({ type: "varchar", length: 50 })
  number: string;

  @Column({ type: "date" })
  issueDate: Date;

  @Column({ type: "date", nullable: true })
  dueDate: Date;

  @Column({ type: "uuid" })
  customerId: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: "customerId" })
  customer: Customer;

  @Column({ type: "decimal", precision: 20, scale: 2, default: 0 })
  subtotal: string;

  @Column({ type: "decimal", precision: 20, scale: 2, default: 0 })
  totalTax: string;

  @Column({ type: "decimal", precision: 20, scale: 2, default: 0 })
  totalAmount: string;

  @Column({ type: "enum", enum: QuotationStatus, default: QuotationStatus.DRAFT })
  status: QuotationStatus;

  @Column({ type: "text", nullable: true })
  notes: string;

  @OneToMany("QuotationLine", (line: QuotationLine) => line.quotation, { cascade: true })
  lines: QuotationLine[];
}
