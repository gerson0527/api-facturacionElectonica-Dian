import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase18RadianEvents1783955650565 implements MigrationInterface {
    name = 'Phase18RadianEvents1783955650565'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "radian_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenant_id" uuid NOT NULL, "invoice_id" uuid NOT NULL, "event_code" character varying(10) NOT NULL, "cude" character varying(100), "status" character varying(50) NOT NULL DEFAULT 'pending', "track_id" character varying(100), "response_message" text, "xml_path" text, "dian_response_path" text, CONSTRAINT "PK_116b2667e4c3257797033f55323" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "radian_events" ADD CONSTRAINT "FK_75a67cb3eb6269562b1cdace6d6" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "radian_events" ADD CONSTRAINT "FK_0d00802385cc12f7fd4bd4e3cf6" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "radian_events" DROP CONSTRAINT "FK_0d00802385cc12f7fd4bd4e3cf6"`);
        await queryRunner.query(`ALTER TABLE "radian_events" DROP CONSTRAINT "FK_75a67cb3eb6269562b1cdace6d6"`);
        await queryRunner.query(`DROP TABLE "radian_events"`);
    }

}
