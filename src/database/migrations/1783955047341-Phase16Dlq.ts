import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase16Dlq1783955047341 implements MigrationInterface {
    name = 'Phase16Dlq1783955047341'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "dian_dlq" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenant_id" uuid NOT NULL, "payload" jsonb NOT NULL, "last_error" text NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'pending', "invoice_id" uuid, CONSTRAINT "PK_c6c0fedbcd404738060cc1697ae" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "dian_dlq" ADD CONSTRAINT "FK_5c8f2c5ac6ea0ed57cc8dfe26b2" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dian_dlq" ADD CONSTRAINT "FK_c020cc124db6db88d0a0bf27136" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dian_dlq" DROP CONSTRAINT "FK_c020cc124db6db88d0a0bf27136"`);
        await queryRunner.query(`ALTER TABLE "dian_dlq" DROP CONSTRAINT "FK_5c8f2c5ac6ea0ed57cc8dfe26b2"`);
        await queryRunner.query(`DROP TABLE "dian_dlq"`);
    }

}
