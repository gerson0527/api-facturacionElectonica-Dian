import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNumberingRangeValidity1784000000001
  implements MigrationInterface
{
  name = "AddNumberingRangeValidity1784000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "numbering_ranges" ADD COLUMN IF NOT EXISTS "valid_from" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "numbering_ranges" ADD COLUMN IF NOT EXISTS "valid_to" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "numbering_ranges" ADD CONSTRAINT "ck_numbering_validity" CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "numbering_ranges" DROP CONSTRAINT IF EXISTS "ck_numbering_validity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "numbering_ranges" DROP COLUMN IF EXISTS "valid_to"`,
    );
    await queryRunner.query(
      `ALTER TABLE "numbering_ranges" DROP COLUMN IF EXISTS "valid_from"`,
    );
  }
}