import { MigrationInterface, QueryRunner } from "typeorm";

export class IdempotencyMultiempresa1783919379323 implements MigrationInterface {
    name = 'IdempotencyMultiempresa1783919379323'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invoices" ADD "request_payload_hash" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "response_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "response_status_code" integer`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD "expires_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "debit_notes" ADD "idempotency_key" uuid`);
        await queryRunner.query(`ALTER TABLE "debit_notes" ADD "request_payload_hash" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "debit_notes" ADD "response_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "debit_notes" ADD "response_status_code" integer`);
        await queryRunner.query(`ALTER TABLE "debit_notes" ADD "expires_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "credit_notes" ADD "idempotency_key" uuid`);
        await queryRunner.query(`ALTER TABLE "credit_notes" ADD "request_payload_hash" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "credit_notes" ADD "response_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "credit_notes" ADD "response_status_code" integer`);
        await queryRunner.query(`ALTER TABLE "credit_notes" ADD "expires_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "UQ_2bc7ea1d26b4e2d220ba47d7d71"`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "uq_invoices_tenant_idempotency" UNIQUE ("tenant_id", "idempotency_key")`);
        await queryRunner.query(`ALTER TABLE "debit_notes" ADD CONSTRAINT "uq_debit_notes_tenant_idempotency" UNIQUE ("tenant_id", "idempotency_key")`);
        await queryRunner.query(`ALTER TABLE "credit_notes" ADD CONSTRAINT "uq_credit_notes_tenant_idempotency" UNIQUE ("tenant_id", "idempotency_key")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "credit_notes" DROP CONSTRAINT "uq_credit_notes_tenant_idempotency"`);
        await queryRunner.query(`ALTER TABLE "debit_notes" DROP CONSTRAINT "uq_debit_notes_tenant_idempotency"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "uq_invoices_tenant_idempotency"`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "UQ_2bc7ea1d26b4e2d220ba47d7d71" UNIQUE ("idempotency_key")`);
        await queryRunner.query(`ALTER TABLE "credit_notes" DROP COLUMN "expires_at"`);
        await queryRunner.query(`ALTER TABLE "credit_notes" DROP COLUMN "response_status_code"`);
        await queryRunner.query(`ALTER TABLE "credit_notes" DROP COLUMN "response_snapshot"`);
        await queryRunner.query(`ALTER TABLE "credit_notes" DROP COLUMN "request_payload_hash"`);
        await queryRunner.query(`ALTER TABLE "credit_notes" DROP COLUMN "idempotency_key"`);
        await queryRunner.query(`ALTER TABLE "debit_notes" DROP COLUMN "expires_at"`);
        await queryRunner.query(`ALTER TABLE "debit_notes" DROP COLUMN "response_status_code"`);
        await queryRunner.query(`ALTER TABLE "debit_notes" DROP COLUMN "response_snapshot"`);
        await queryRunner.query(`ALTER TABLE "debit_notes" DROP COLUMN "request_payload_hash"`);
        await queryRunner.query(`ALTER TABLE "debit_notes" DROP COLUMN "idempotency_key"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "expires_at"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "response_status_code"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "response_snapshot"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "request_payload_hash"`);
    }

}
