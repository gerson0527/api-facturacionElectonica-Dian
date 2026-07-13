import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { TenantEntity } from "./base.entity";
import { Tenant } from "./tenant.entity";
import { Invoice } from "./invoice.entity";

@Entity("dian_dlq")
export class DianDlq extends TenantEntity {
  @Column({ type: "jsonb" })
  payload: any;

  @Column({ type: "text", name: "last_error" })
  lastError: string;

  @Column({ type: "varchar", length: 50, default: "pending" })
  status: string; // pending, resolved

  @ManyToOne(() => Invoice, { onDelete: "CASCADE" })
  @JoinColumn({ name: "invoice_id" })
  invoice: Invoice;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;
}
