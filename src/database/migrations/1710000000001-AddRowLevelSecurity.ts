import { MigrationInterface, QueryRunner } from "typeorm";

const TABLES_WITH_TENANT = [
  "tenants",
  "users",
  "dian_software_credentials",
  "digital_certificates",
  "numbering_ranges",
  "customers",
  "invoices",
  "invoice_lines",
  "tax_totals",
  "dian_submissions",
  "credit_notes",
  "debit_notes",
  "audit_events",
];

export class AddRowLevelSecurity1710000000001 implements MigrationInterface {
  name = "AddRowLevelSecurity1710000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable RLS on all tenant-bound tables
    for (const table of TABLES_WITH_TENANT) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
    }

    // Create policies for each table
    for (const table of TABLES_WITH_TENANT) {
      // SELECT policy
      await queryRunner.query(`
        CREATE POLICY "${table}_tenant_isolation_select" ON "${table}"
          FOR SELECT
          USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
      `);

      // INSERT policy
      await queryRunner.query(`
        CREATE POLICY "${table}_tenant_isolation_insert" ON "${table}"
          FOR INSERT
          WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
      `);

      // UPDATE policy
      await queryRunner.query(`
        CREATE POLICY "${table}_tenant_isolation_update" ON "${table}"
          FOR UPDATE
          USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
          WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
      `);

      // DELETE policy
      await queryRunner.query(`
        CREATE POLICY "${table}_tenant_isolation_delete" ON "${table}"
          FOR DELETE
          USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES_WITH_TENANT) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS "${table}_tenant_isolation_select" ON "${table}"`,
      );
      await queryRunner.query(
        `DROP POLICY IF EXISTS "${table}_tenant_isolation_insert" ON "${table}"`,
      );
      await queryRunner.query(
        `DROP POLICY IF EXISTS "${table}_tenant_isolation_update" ON "${table}"`,
      );
      await queryRunner.query(
        `DROP POLICY IF EXISTS "${table}_tenant_isolation_delete" ON "${table}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`,
      );
    }
  }
}
