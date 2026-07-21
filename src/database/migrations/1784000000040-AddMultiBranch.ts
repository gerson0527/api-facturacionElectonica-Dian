import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMultiBranch1784000000040 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "branches" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "tenant_id" uuid NOT NULL,
      "name" varchar(200) NOT NULL,
      "address" varchar(200),
      "phone" varchar(50),
      "municipality_code" varchar(5),
      "is_active" boolean NOT NULL DEFAULT true,
      "is_main" boolean NOT NULL DEFAULT false,
      CONSTRAINT "pk_branches" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`CREATE INDEX "ix_branches_tenant" ON "branches" ("tenant_id")`);
    await queryRunner.query(`ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`CREATE POLICY branches_tenant ON "branches" USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`);

    await queryRunner.query(`CREATE TABLE "warehouses" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "tenant_id" uuid NOT NULL,
      "branch_id" uuid NOT NULL,
      "name" varchar(200) NOT NULL,
      "is_active" boolean NOT NULL DEFAULT true,
      "is_default" boolean NOT NULL DEFAULT false,
      CONSTRAINT "pk_warehouses" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`CREATE INDEX "ix_warehouses_branch" ON "warehouses" ("tenant_id", "branch_id")`);
    await queryRunner.query(`ALTER TABLE "warehouses" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`CREATE POLICY warehouses_tenant ON "warehouses" USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`);

    await queryRunner.query(`CREATE TABLE "product_stocks" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "tenant_id" uuid NOT NULL,
      "product_id" uuid NOT NULL,
      "branch_id" uuid NOT NULL,
      "warehouse_id" uuid NOT NULL,
      "quantity" numeric(18,4) NOT NULL DEFAULT 0,
      "reserved_quantity" numeric(18,4) NOT NULL DEFAULT 0,
      CONSTRAINT "pk_product_stocks" PRIMARY KEY ("id"),
      CONSTRAINT "uq_product_stock" UNIQUE ("tenant_id", "product_id", "branch_id", "warehouse_id"),
      CONSTRAINT "ck_product_stock_qty" CHECK (quantity >= 0 AND reserved_quantity >= 0)
    )`);
    await queryRunner.query(`ALTER TABLE "product_stocks" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`CREATE POLICY product_stocks_tenant ON "product_stocks" USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`);

    await queryRunner.query(`CREATE INDEX "ix_invoices_tenant_status" ON "invoices" ("tenant_id", "status")`);
    await queryRunner.query(`CREATE INDEX "ix_invoices_tenant_created" ON "invoices" ("tenant_id", "created_at" DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_invoices_tenant_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_invoices_tenant_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_stocks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "warehouses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "branches"`);
  }
}
