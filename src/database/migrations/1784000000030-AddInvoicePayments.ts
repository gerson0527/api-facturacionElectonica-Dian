import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoicePayments1784000000030 implements MigrationInterface {
  name = 'AddInvoicePayments1784000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "invoice_payments" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "tenant_id" uuid NOT NULL,
      "invoice_id" uuid NOT NULL,
      "payment_method_code" varchar(5) NOT NULL,
      "amount" numeric(20,2) NOT NULL,
      "reference" varchar(200),
      "received_by" varchar(200),
      "paid_at" varchar(10),
      CONSTRAINT "pk_invoice_payments" PRIMARY KEY ("id"),
      CONSTRAINT "ck_invoice_payments_amount" CHECK (amount > 0)
    )`);
    await queryRunner.query(
      `CREATE INDEX "ix_invoice_payments_invoice" ON "invoice_payments" ("invoice_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_payments" ADD CONSTRAINT "fk_invoice_payments_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_payments" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY invoice_payments_tenant ON "invoice_payments" USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_payments"`);
  }
}