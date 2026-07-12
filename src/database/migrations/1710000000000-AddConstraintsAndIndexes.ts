import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConstraintsAndIndexes1710000000000 implements MigrationInterface {
  name = 'AddConstraintsAndIndexes1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Unique idempotency per tenant
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_invoices_tenant_idempotency') THEN
          ALTER TABLE invoices ADD CONSTRAINT uq_invoices_tenant_idempotency UNIQUE (tenant_id, idempotency_key);
        END IF;
      END $$;
    `);

    // Unique consecutive number per tenant
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_tenant_number ON invoices (tenant_id, number);
    `);

    // Indexes for frequent queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_invoices_tenant_status_issue_date
        ON invoices (tenant_id, status, issue_date DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_dian_submissions_tenant_invoice_created
        ON dian_submissions (tenant_id, invoice_id, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_customers_tenant_document
        ON customers (tenant_id, document_type, document_number);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_numbering_ranges_tenant_active
        ON numbering_ranges (tenant_id, is_active, prefix);
    `);

    // Audit append-only trigger
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_mutations()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'audit_events is append-only: UPDATE and DELETE are prohibited';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_audit_update') THEN
          CREATE TRIGGER trg_prevent_audit_update
            BEFORE UPDATE ON audit_events
            FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutations();
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_audit_delete') THEN
          CREATE TRIGGER trg_prevent_audit_delete
            BEFORE DELETE ON audit_events
            FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutations();
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON audit_events`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_prevent_audit_update ON audit_events`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_audit_mutations`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_numbering_ranges_tenant_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_customers_tenant_document`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_dian_submissions_tenant_invoice_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_invoices_tenant_status_issue_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_invoices_tenant_number`);
    await queryRunner.query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS uq_invoices_tenant_idempotency`);
  }
}
