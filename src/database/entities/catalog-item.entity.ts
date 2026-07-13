import { Entity, Column, Index } from "typeorm";
import { BaseEntity } from "./base.entity";

@Entity("catalog_items")
@Index(["catalogType", "code"], { unique: true })
export class CatalogItem extends BaseEntity {
  @Column({ type: "varchar", length: 50 })
  catalogType: string;

  @Column({ type: "varchar", length: 20 })
  code: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "boolean", default: true })
  isActive: boolean;
}
