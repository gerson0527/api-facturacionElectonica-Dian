import { Column, Entity } from "typeorm";
import { BaseEntity } from "./base.entity";

@Entity("plans")
export class Plan extends BaseEntity {
  @Column("varchar", { length: 50, unique: true })
  code: string;

  @Column("varchar", { length: 100 })
  name: string;

  @Column("text", { nullable: true })
  description: string;

  @Column("numeric", { precision: 18, scale: 2, name: "price_monthly" })
  priceMonthly: string;

  @Column("numeric", { precision: 18, scale: 2, name: "price_yearly" })
  priceYearly: string;

  @Column("varchar", { length: 10, default: "COP" })
  currency: string;

  @Column("int", { name: "max_users" })
  maxUsers: number;

  @Column("int", { name: "max_branches" })
  maxBranches: number;

  @Column("int", { name: "max_cash_registers" })
  maxCashRegisters: number;

  @Column("int", { name: "max_products" })
  maxProducts: number;

  @Column("int", { name: "max_invoices_per_month" })
  maxInvoicesPerMonth: number;

  @Column("boolean", { default: true, name: "is_active" })
  isActive: boolean;
}
