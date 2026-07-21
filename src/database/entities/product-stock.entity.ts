import { Entity, Column, Unique } from "typeorm";
import { TenantEntity } from "./base.entity";

@Entity("product_stocks")
@Unique("uq_product_stock", ["tenantId", "productId", "branchId", "warehouseId"])
export class ProductStock extends TenantEntity {
  @Column("uuid", { name: "product_id" })
  productId: string;

  @Column("uuid", { name: "branch_id" })
  branchId: string;

  @Column("uuid", { name: "warehouse_id" })
  warehouseId: string;

  @Column("numeric", { precision: 18, scale: 4, default: 0 })
  quantity: string;

  @Column("numeric", { precision: 18, scale: 4, default: 0, name: "reserved_quantity" })
  reservedQuantity: string;
}
