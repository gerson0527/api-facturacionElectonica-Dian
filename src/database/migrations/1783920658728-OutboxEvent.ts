import { MigrationInterface, QueryRunner } from "typeorm";

export class OutboxEvent1783920658728 implements MigrationInterface {
    name = 'OutboxEvent1783920658728'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "outbox_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenant_id" uuid NOT NULL, "aggregateType" character varying(50) NOT NULL, "aggregateId" uuid NOT NULL, "eventType" character varying(100) NOT NULL, "payload" jsonb NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "error" text, "processedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_20aabf8156809552c09e5deb1b" ON "outbox_events" ("aggregateType") `);
        await queryRunner.query(`CREATE INDEX "IDX_a24c3217a29817c76d4f7403c5" ON "outbox_events" ("aggregateId") `);
        await queryRunner.query(`CREATE INDEX "IDX_733fafe6b0ec20ec7c93fdbbca" ON "outbox_events" ("status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_733fafe6b0ec20ec7c93fdbbca"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a24c3217a29817c76d4f7403c5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_20aabf8156809552c09e5deb1b"`);
        await queryRunner.query(`DROP TABLE "outbox_events"`);
    }

}
