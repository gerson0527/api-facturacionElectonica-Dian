import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCashTables1784000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "cash_registers" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "tenant_id" uuid NOT NULL,
      "name" varchar(200) NOT NULL,
      "branch_id" uuid NOT NULL,
      "location" varchar(200),
      "active" boolean NOT NULL DEFAULT true,
      "opening_balance_default" numeric(18,2) NOT NULL DEFAULT 0,
      CONSTRAINT "pk_cash_registers" PRIMARY KEY ("id")
    )`);

    await queryRunner.query(`CREATE TABLE "cash_sessions" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "tenant_id" uuid NOT NULL,
      "cash_register_id" uuid NOT NULL,
      "branch_id" uuid NOT NULL,
      "opened_by" uuid NOT NULL,
      "closed_by" uuid,
      "opening_amount" numeric(18,2) NOT NULL,
      "closing_amount" numeric(18,2),
      "expected_amount" numeric(18,2),
      "difference" numeric(18,2),
      "status" varchar(20) NOT NULL DEFAULT 'open',
      "opened_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      "closed_at" TIMESTAMP WITH TIME ZONE,
      "close_notes" text,
      CONSTRAINT "pk_cash_sessions" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`CREATE INDEX "ix_cash_sessions_tenant_status" ON "cash_sessions" ("tenant_id", "status")`);
    await queryRunner.query(`ALTER TABLE "cash_sessions" ADD CONSTRAINT "fk_cash_sessions_register" FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id")`);

    await queryRunner.query(`CREATE TABLE "cash_movements" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "tenant_id" uuid NOT NULL,
      "cash_session_id" uuid NOT NULL,
      "type" varchar(30) NOT NULL,
      "payment_method" varchar(30) NOT NULL,
      "amount" numeric(18,2) NOT NULL,
      "reference_id" uuid,
      "reference_type" varchar(30),
      "user_id" uuid NOT NULL,
      "notes" text,
      CONSTRAINT "pk_cash_movements" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`CREATE INDEX "ix_cash_movements_session" ON "cash_movements" ("tenant_id", "cash_session_id", "created_at")`);
    await queryRunner.query(`ALTER TABLE "cash_movements" ADD CONSTRAINT "fk_cash_movements_session" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id")`);

    // CHECK constraint: stock no negativo
    await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "ck_products_stock_nonneg" CHECK (stock >= 0)`);

    // RLS para las nuevas tablas
    await queryRunner.query(`ALTER TABLE "cash_registers" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`CREATE POLICY cash_registers_tenant ON "cash_registers" USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`);
    await queryRunner.query(`ALTER TABLE "cash_sessions" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`CREATE POLICY cash_sessions_tenant ON "cash_sessions" USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`);
    await queryRunner.query(`ALTER TABLE "cash_movements" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`CREATE POLICY cash_movements_tenant ON "cash_movements" USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS "products" DROP CONSTRAINT IF EXISTS "ck_products_stock_nonneg"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cash_movements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cash_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cash_registers"`);
  }
}