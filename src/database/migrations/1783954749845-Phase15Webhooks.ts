import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase15Webhooks1783954749845 implements MigrationInterface {
    name = 'Phase15Webhooks1783954749845'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "webhook_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenant_id" uuid NOT NULL, "event" character varying(100) NOT NULL, "payload" jsonb NOT NULL, "status_code" integer, "response_time_ms" integer, "response_body" text, "status" character varying(50) NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "invoice_id" uuid, "endpoint_id" uuid, CONSTRAINT "PK_535dd409947fb6d8fc6dfc0112a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "webhook_endpoints" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenant_id" uuid NOT NULL, "url" character varying(500) NOT NULL, "secret" character varying(200) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "subscribedEvents" jsonb, CONSTRAINT "PK_054c4cfb95223732f5939d2d546" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "FK_0b882c26a9b91c26e6e86b4867c" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "FK_dd2bc3de0e4a0329a4ef30600b4" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "FK_54847f2dacee9618585993f1474" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "webhook_endpoints" DROP CONSTRAINT "FK_54847f2dacee9618585993f1474"`);
        await queryRunner.query(`ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "FK_dd2bc3de0e4a0329a4ef30600b4"`);
        await queryRunner.query(`ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "FK_0b882c26a9b91c26e6e86b4867c"`);
        await queryRunner.query(`DROP TABLE "webhook_endpoints"`);
        await queryRunner.query(`DROP TABLE "webhook_deliveries"`);
    }

}
