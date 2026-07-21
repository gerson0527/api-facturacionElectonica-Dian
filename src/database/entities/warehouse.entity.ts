import { Entity, Column, Index } from "typeorm";
import { TenantEntity } from "./base.entity";

@Entity("warehouses")
@Index("ix_warehouses_branch", ["tenantId", "branchId"])
export class Warehouse extends TenantEntity {
  @Column("uuid", { name: "branch_id" })
  branchId: string;

  @Column("varchar", { length: 200 })
  name: string;

  @Column("boolean", { default: true, name: "is_active" })
  isActive: boolean;

  @Column("boolean", { default: false, name: "is_default" })
  isDefault: boolean;
}
