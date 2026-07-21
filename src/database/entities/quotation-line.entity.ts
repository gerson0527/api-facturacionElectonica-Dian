import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { TenantEntity } from "./base.entity";
import type { Quotation } from "./quotation.entity";

@Entity("quotation_lines")
export class QuotationLine extends TenantEntity {
  @Column({ type: "uuid" })
  quotationId: string;

  @ManyToOne("Quotation", (quotation: Quotation) => quotation.lines, { onDelete: "CASCADE" })
  @JoinColumn({ name: "quotationId" })
  quotation: Quotation;

  @Column({ type: "int" })
  lineNumber: number;

  @Column({ type: "varchar", length: 255 })
  description: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: "decimal", precision: 20, scale: 2 })
  unitPrice: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  taxPercent: number;

  @Column({ type: "decimal", precision: 20, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: "decimal", precision: 20, scale: 2, default: 0 })
  lineExtensionAmount: number;
}
