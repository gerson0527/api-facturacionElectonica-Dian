import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1710000000000 implements MigrationInterface {
  name = "InitialMigration1710000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Tenants
    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "name" VARCHAR(200) NOT NULL,
        "nit" VARCHAR(20) NOT NULL UNIQUE,
        "dv" VARCHAR(1) DEFAULT '0',
        "address" VARCHAR(255),
        "phone" VARCHAR(50),
        "email" VARCHAR(200),
        "enabled" BOOLEAN DEFAULT true,
        "environment" VARCHAR(20) DEFAULT 'habilitacion'
      )
    `);

    // Users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "tenant_id" uuid NOT NULL REFERENCES tenants(id),
        "email" VARCHAR(255) NOT NULL UNIQUE,
        "hashed_password" VARCHAR(255) NOT NULL,
        "full_name" VARCHAR(200) NOT NULL,
        "role" VARCHAR(50) DEFAULT 'tenant_user',
        "is_active" BOOLEAN DEFAULT true
      )
    `);

    // Dian Software Credentials
    await queryRunner.query(`
      CREATE TABLE "dian_software_credentials" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "tenant_id" uuid NOT NULL REFERENCES tenants(id),
        "software_id" VARCHAR(100) NOT NULL,
        "software_pin_encrypted" TEXT NOT NULL,
        "test_set_id" VARCHAR(100),
        "habilitacion_status" VARCHAR(50) DEFAULT 'pending'
      )
    `);

    // Digital Certificates
    await queryRunner.query(`
      CREATE TABLE "digital_certificates" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "tenant_id" uuid NOT NULL REFERENCES tenants(id),
        "alias" VARCHAR(200) NOT NULL,
        "encrypted_pfx_path" TEXT NOT NULL,
        "encrypted_password_ref" TEXT NOT NULL,
        "encrypted_pin_ref" TEXT,
        "is_active" BOOLEAN DEFAULT true
      )
    `);

    // Numbering Ranges
    await queryRunner.query(`
      CREATE TABLE "numbering_ranges" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "tenant_id" uuid NOT NULL REFERENCES tenants(id),
        "prefix" VARCHAR(10) NOT NULL,
        "from_number" INT NOT NULL,
        "to_number" INT NOT NULL,
        "current_number" INT DEFAULT 0,
        "resolution_number" VARCHAR(100) NOT NULL,
        "resolution_date" DATE NOT NULL,
        "is_active" BOOLEAN DEFAULT true
      )
    `);

    // Customers
    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "tenant_id" uuid NOT NULL REFERENCES tenants(id),
        "document_type" VARCHAR(5) NOT NULL,
        "document_number" VARCHAR(30) NOT NULL,
        "dv" VARCHAR(2),
        "name" VARCHAR(300) NOT NULL,
        "address" VARCHAR(255),
        "phone" VARCHAR(50),
        "email" VARCHAR(200),
        "municipality_code" VARCHAR(10),
        "fiscal_responsibilities" JSONB
      )
    `);

    // Invoices
    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "tenant_id" uuid NOT NULL REFERENCES tenants(id),
        "number" VARCHAR(30) NOT NULL,
        "invoice_type" VARCHAR(5) DEFAULT '01',
        "payment_form_code" VARCHAR(5) DEFAULT '1',
        "payment_method_code" VARCHAR(5) DEFAULT '10',
        "issue_date" DATE NOT NULL,
        "due_date" DATE,
        "customer_id" uuid,
        "customer_name" VARCHAR(300) NOT NULL,
        "customer_document" VARCHAR(30) NOT NULL,
        "customer_document_type" VARCHAR(5) NOT NULL,
        "subtotal" DECIMAL(20,2) DEFAULT 0,
        "total_tax" DECIMAL(20,2) DEFAULT 0,
        "total_amount" DECIMAL(20,2) DEFAULT 0,
        "status" VARCHAR(50) DEFAULT 'draft',
        "cufe" VARCHAR(96),
        "qr_code" TEXT,
        "xml_path" TEXT,
        "signed_xml_path" TEXT,
        "pdf_path" TEXT,
        "dian_response_path" TEXT,
        "idempotency_key" uuid NOT NULL UNIQUE
      )
    `);

    // Invoice Lines
    await queryRunner.query(`
      CREATE TABLE "invoice_lines" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "tenant_id" uuid NOT NULL REFERENCES tenants(id),
        "invoice_id" uuid NOT NULL REFERENCES invoices(id),
        "line_number" INT NOT NULL,
        "description" VARCHAR(500) NOT NULL,
        "quantity" DECIMAL(20,4) NOT NULL,
        "unit_code" VARCHAR(10) DEFAULT '94',
        "unit_price" DECIMAL(20,2) NOT NULL,
        "line_extension_amount" DECIMAL(20,2) NOT NULL,
        "tax_amount" DECIMAL(20,2) DEFAULT 0,
        "tax_code" VARCHAR(10) DEFAULT '01',
        "tax_percent" DECIMAL(5,2) DEFAULT 19
      )
    `);

    // Tax Totals
    await queryRunner.query(`
      CREATE TABLE "tax_totals" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "tenant_id" uuid NOT NULL REFERENCES tenants(id),
        "invoice_id" uuid NOT NULL REFERENCES invoices(id),
        "tax_id" VARCHAR(10) NOT NULL,
        "tax_percent" DECIMAL(5,2) NOT NULL,
        "taxable_amount" DECIMAL(20,2) NOT NULL,
        "tax_amount" DECIMAL(20,2) NOT NULL
      )
    `);

    // Credit Notes
    await queryRunner.query(`
      CREATE TABLE "credit_notes" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "tenant_id" uuid NOT NULL REFERENCES tenants(id),
        "invoice_id" uuid NOT NULL REFERENCES invoices(id),
        "number" VARCHAR(30) NOT NULL,
        "issue_date" DATE NOT NULL,
        "reason_code" VARCHAR(10) NOT NULL,
        "total_amount" DECIMAL(20,2) NOT NULL,
        "status" VARCHAR(50) DEFAULT 'draft',
        "cufe" VARCHAR(96),
        "xml_path" TEXT,
        "signed_xml_path" TEXT
      )
    `);

    // Debit Notes
    await queryRunner.query(`
      CREATE TABLE "debit_notes" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "tenant_id" uuid NOT NULL REFERENCES tenants(id),
        "invoice_id" uuid NOT NULL REFERENCES invoices(id),
        "number" VARCHAR(30) NOT NULL,
        "issue_date" DATE NOT NULL,
        "reason_code" VARCHAR(10) NOT NULL,
        "total_amount" DECIMAL(20,2) NOT NULL,
        "status" VARCHAR(50) DEFAULT 'draft',
        "cufe" VARCHAR(96),
        "xml_path" TEXT,
        "signed_xml_path" TEXT
      )
    `);

    // Dian Submissions
    await queryRunner.query(`
      CREATE TABLE "dian_submissions" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "tenant_id" uuid NOT NULL REFERENCES tenants(id),
        "invoice_id" uuid NOT NULL REFERENCES invoices(id),
        "document_type" VARCHAR(20) NOT NULL,
        "attempt_number" INT DEFAULT 1,
        "status" VARCHAR(50) DEFAULT 'pending',
        "request_zip_path" TEXT,
        "response_zip_path" TEXT,
        "response_message" TEXT,
        "response_cufe" VARCHAR(100),
        "submitted_at" TIMESTAMPTZ,
        "responded_at" TIMESTAMPTZ
      )
    `);

    // Audit Events
    await queryRunner.query(`
      CREATE TABLE "audit_events" (
        "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "tenant_id" uuid NOT NULL,
        "actor" VARCHAR(100) NOT NULL,
        "action" VARCHAR(255) NOT NULL,
        "entity_type" VARCHAR(100) NOT NULL,
        "entity_id" VARCHAR(100),
        "details" JSONB,
        "ip_address" VARCHAR(50),
        "user_agent" TEXT
      )
    `);

    // Indexes
    await queryRunner.query(
      `CREATE INDEX idx_users_tenant ON users(tenant_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_invoices_tenant ON invoices(tenant_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_invoices_status ON invoices(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_invoice_lines_invoice ON invoice_lines(invoice_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_tax_totals_invoice ON tax_totals(invoice_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_dian_submissions_invoice ON dian_submissions(invoice_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_credit_notes_invoice ON credit_notes(invoice_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_debit_notes_invoice ON debit_notes(invoice_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_audit_events_tenant ON audit_events(tenant_id, entity_type, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_customers_tenant ON customers(tenant_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_numbering_ranges_tenant ON numbering_ranges(tenant_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_events" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dian_submissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "debit_notes" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_notes" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tax_totals" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_lines" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customers" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "numbering_ranges" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "digital_certificates" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "dian_software_credentials" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenants" CASCADE`);
  }
}
