import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { TenantEntity } from "./base.entity";
import { Tenant } from "./tenant.entity";
import { Product } from "./product.entity";

export enum MovementType {
  IN = 'IN',
  OUT = 'OUT'
}

@Entity("inventory_movements")
export class InventoryMovement extends TenantEntity {
  @Column({ type: "enum", enum: MovementType })
  type: MovementType;

  @Column({ type: "int" })
  quantity: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  reason: string; // e.g. "Venta", "Compra", "Ajuste"

  @Column({ type: "varchar", length: 100, nullable: true })
  reference: string; // e.g. "FE-123", "FC-456"

  @ManyToOne(() => Product)
  @JoinColumn({ name: "product_id" })
  product: Product;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;
}
