import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPins1784000000020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "user_pins" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "tenant_id" uuid NOT NULL,
      "user_id" uuid NOT NULL,
      "hashed_pin" varchar(255) NOT NULL,
      "failed_attempts" int NOT NULL DEFAULT 0,
      "locked_until" TIMESTAMP WITH TIME ZONE,
      "pin_set_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      CONSTRAINT "pk_user_pins" PRIMARY KEY ("id"),
      CONSTRAINT "uq_user_pins_user" UNIQUE ("user_id")
    )`);
    await queryRunner.query(`ALTER TABLE "user_pins" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`CREATE POLICY user_pins_tenant ON "user_pins" USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_pins"`);
  }
}
