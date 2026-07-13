import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { TenantEntity } from "./base.entity";
import { Invoice } from "./invoice.entity";

@Entity("tax_totals")
export class TaxTotal extends TenantEntity {
  @Column({ type: "uuid", name: "invoice_id" })
  invoiceId: string;

  @Column({ type: "varchar", length: 10, name: "tax_id" })
  taxId: string;

  @Column({ type: "decimal", precision: 5, scale: 2, name: "tax_percent" })
  taxPercent: number;

  @Column({ type: "decimal", precision: 20, scale: 2, name: "taxable_amount" })
  taxableAmount: number;

  @Column({ type: "decimal", precision: 20, scale: 2, name: "tax_amount" })
  taxAmount: number;

  @ManyToOne(() => Invoice)
  @JoinColumn({ name: "invoice_id" })
  invoice: Invoice;
}
