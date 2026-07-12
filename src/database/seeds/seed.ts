import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../config/database.config';

async function runSeed() {
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.startTransaction();

    const tenantId = '00000000-0000-0000-0000-000000000001';
    const hashedPassword = '$2b$10$dummy_hash_for_admin'; // Replace with real bcrypt hash

    await queryRunner.query(`
      INSERT INTO tenants (id, name, nit, dv, enabled, environment, created_at, updated_at)
      VALUES ($1, 'Super Admin Tenant', '000000000', '0', true, 'habilitacion', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [tenantId]);

    await queryRunner.query(`
      INSERT INTO users (id, tenant_id, email, hashed_password, full_name, role, is_active, created_at, updated_at)
      VALUES ($1, $2, 'superadmin@system.com', $3, 'Super Admin', 'super_admin', true, NOW(), NOW())
      ON CONFLICT (email) DO NOTHING
    `, [require('uuid').v4(), tenantId, hashedPassword]);

    await queryRunner.commitTransaction();
    console.log('Seed completed successfully');
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error('Seed failed:', err);
    throw err;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

runSeed().catch((err) => {
  console.error(err);
  process.exit(1);
});
