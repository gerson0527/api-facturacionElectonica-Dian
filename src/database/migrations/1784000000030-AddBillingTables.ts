import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingTables1784000000030 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "plans" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "code" varchar(50) NOT NULL UNIQUE,
      "name" varchar(100) NOT NULL,
      "description" text,
      "price_monthly" numeric(18,2) NOT NULL,
      "price_yearly" numeric(18,2) NOT NULL,
      "currency" varchar(10) NOT NULL DEFAULT 'COP',
      "max_users" int NOT NULL,
      "max_branches" int NOT NULL,
      "max_cash_registers" int NOT NULL,
      "max_products" int NOT NULL,
      "max_invoices_per_month" int NOT NULL,
      "is_active" boolean NOT NULL DEFAULT true,
      CONSTRAINT "pk_plans" PRIMARY KEY ("id")
    )`);

    await queryRunner.query(`CREATE TABLE "subscriptions" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "tenant_id" uuid NOT NULL,
      "plan_id" uuid NOT NULL,
      "status" varchar(20) NOT NULL DEFAULT 'trialing',
      "period" varchar(20) NOT NULL DEFAULT 'monthly',
      "trial_ends_at" TIMESTAMP WITH TIME ZONE,
      "current_period_start" TIMESTAMP WITH TIME ZONE,
      "current_period_end" TIMESTAMP WITH TIME ZONE,
      "canceled_at" TIMESTAMP WITH TIME ZONE,
      "mp_preapproval_id" varchar(100),
      "mp_customer_id" varchar(100),
      CONSTRAINT "pk_subscriptions" PRIMARY KEY ("id"),
      CONSTRAINT "uq_subscriptions_tenant" UNIQUE ("tenant_id")
    )`);
    await queryRunner.query(`CREATE INDEX "ix_subscriptions_status" ON "subscriptions" ("status")`);
    await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "fk_subscriptions_plan" FOREIGN KEY ("plan_id") REFERENCES "plans"("id")`);

    await queryRunner.query(`CREATE TABLE "billing_events" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "tenant_id" uuid NOT NULL,
      "subscription_id" uuid,
      "type" varchar(50) NOT NULL,
      "payload" jsonb,
      "mp_payment_id" varchar(100),
      "status" varchar(20) NOT NULL DEFAULT 'pending',
      CONSTRAINT "pk_billing_events" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`CREATE INDEX "ix_billing_events_tenant" ON "billing_events" ("tenant_id", "created_at")`);

    await queryRunner.query(`ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`CREATE POLICY subscriptions_tenant ON "subscriptions" USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`);
    await queryRunner.query(`ALTER TABLE "billing_events" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`CREATE POLICY billing_events_tenant ON "billing_events" USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`);

    await queryRunner.query(`INSERT INTO plans (code, name, description, price_monthly, price_yearly, max_users, max_branches, max_cash_registers, max_products, max_invoices_per_month, is_active) VALUES
      ('free', 'Plan Free', 'Para empezar', 0, 0, 1, 1, 1, 50, 10, true),
      ('basic', 'Plan Basic', 'Para PyMEs', 49900, 499000, 3, 1, 1, 500, 100, true),
      ('pro', 'Plan Pro', 'Para empresas en crecimiento', 99900, 999000, 10, 3, 3, 5000, 1000, true),
      ('enterprise', 'Plan Enterprise', 'Sin límites', 299900, 2999000, 999, 999, 999, 999999, 999999, true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "plans"`);
  }
}
