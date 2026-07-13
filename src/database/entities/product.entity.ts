import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { TenantEntity } from "./base.entity";
import { Tenant } from "./tenant.entity";

@Entity("products")
export class Product extends TenantEntity {
  @Column({ type: "varchar", length: 50 })
  code: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "decimal", precision: 20, scale: 2, default: 0 })
  price: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0, name: "tax_rate" })
  taxRate: number; // e.g. 19 for 19% IVA

  @Column({ type: "int", default: 0 })
  stock: number;

  @Column({ type: "varchar", length: 20, nullable: true })
  unitOfMeasure: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;
}
