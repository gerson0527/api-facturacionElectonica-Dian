import { Entity, Column, Index } from "typeorm";
import { TenantEntity } from "./base.entity";

@Entity("branches")
@Index("ix_branches_tenant", ["tenantId"])
export class Branch extends TenantEntity {
  @Column("varchar", { length: 200 })
  name: string;

  @Column("varchar", { length: 200, nullable: true })
  address: string;

  @Column("varchar", { length: 50, nullable: true })
  phone: string;

  @Column("varchar", { length: 5, nullable: true, name: "municipality_code" })
  municipalityCode: string;

  @Column("boolean", { default: true, name: "is_active" })
  isActive: boolean;

  @Column("boolean", { default: false, name: "is_main" })
  isMain: boolean;
}
