import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMemberships1784000000000 implements MigrationInterface {
  name = "AddMemberships1784000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "role" varchar(30) NOT NULL DEFAULT 'tenant_user',
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "pk_memberships" PRIMARY KEY ("id"),
        CONSTRAINT "uq_memberships_user_tenant" UNIQUE ("user_id", "tenant_id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_memberships_tenant" ON "memberships" ("tenant_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD CONSTRAINT "fk_memberships_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "memberships" ADD CONSTRAINT "fk_memberships_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(`
      INSERT INTO memberships (user_id, tenant_id, role, is_active)
      SELECT id, tenant_id, role, is_active FROM users
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(
      `ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY memberships_tenant_isolation ON "memberships" USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "memberships"`);
  }
}
