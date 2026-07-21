import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { TenantEntity } from "./base.entity";
import { Invoice } from "./invoice.entity";

@Entity("payments")
export class Payment extends TenantEntity {
  @Column({ type: "varchar", length: 100, unique: true })
  paymentNumber: string;

  @Column({ type: "uuid" })
  invoiceId: string;

  @ManyToOne("Invoice")
  @JoinColumn({ name: "invoiceId" })
  invoice: Invoice;

  @Column({ type: "decimal", precision: 15, scale: 2 })
  amount: number;

  @Column({ type: "varchar", length: 50 })
  method: string;

  @Column({ type: "date" })
  paymentDate: Date;

  @Column({ type: "varchar", length: 50, default: "Aprobado" })
  status: string;

  @Column({ type: "text", nullable: true })
  notes: string;
}
