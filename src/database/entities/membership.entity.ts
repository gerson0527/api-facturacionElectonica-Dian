import { Entity, Column, ManyToOne, JoinColumn, Unique, Index } from "typeorm";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";
import { Tenant } from "./tenant.entity";

@Entity("memberships")
@Unique("uq_memberships_user_tenant", ["userId", "tenantId"])
@Index("ix_memberships_tenant", ["tenantId"])
export class Membership extends BaseEntity {
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column("uuid", { name: "user_id" })
  userId: string;

  @ManyToOne(() => Tenant, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;

  @Column("uuid", { name: "tenant_id" })
  tenantId: string;

  @Column("varchar", { length: 30, default: "tenant_user" })
  role: string;

  @Column("boolean", { default: true, name: "is_active" })
  isActive: boolean;
}
