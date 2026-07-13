import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { TenantEntity } from "./base.entity";
import type { Invoice } from "./invoice.entity";

@Entity("invoice_lines")
export class InvoiceLine extends TenantEntity {
  @Column({ type: "uuid", name: "invoice_id" })
  invoiceId: string;

  @Column({ type: "int", name: "line_number" })
  lineNumber: number;

  @Column({ type: "varchar", length: 500 })
  description: string;

  @Column({ type: "decimal", precision: 20, scale: 4 })
  quantity: number;

  @Column({ type: "varchar", length: 10, name: "unit_code", default: "94" })
  unitCode: string;

  @Column({ type: "decimal", precision: 20, scale: 2, name: "unit_price" })
  unitPrice: number;

  @Column({
    type: "decimal",
    precision: 20,
    scale: 2,
    name: "line_extension_amount",
  })
  lineExtensionAmount: number;

  @Column({
    type: "decimal",
    precision: 20,
    scale: 2,
    default: 0,
    name: "tax_amount",
  })
  taxAmount: number;

  @Column({ type: "varchar", length: 10, default: "01", name: "tax_code" })
  taxCode: string;

  @Column({
    type: "decimal",
    precision: 5,
    scale: 2,
    default: 19,
    name: "tax_percent",
  })
  taxPercent: number;

  @ManyToOne("Invoice")
  @JoinColumn({ name: "invoice_id" })
  invoice: Invoice;
}
