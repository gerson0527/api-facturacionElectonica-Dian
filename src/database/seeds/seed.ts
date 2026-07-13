import { DataSource } from "typeorm";
import { dataSourceOptions } from "../../config/database.config";
import { seedCatalogs } from "./catalogs.seed";

async function runSeed() {
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.startTransaction();

    const tenantId = "00000000-0000-0000-0000-000000000001";
    const hashedPassword = "$2b$10$dummy_hash_for_admin"; // Replace with real bcrypt hash

    const tenantRepo = queryRunner.manager.getRepository("Tenant");
    const userRepo = queryRunner.manager.getRepository("User");

    let tenant = await tenantRepo.findOneBy({ id: tenantId });
    if (!tenant) {
      tenant = tenantRepo.create({
        id: tenantId,
        name: 'Super Admin Tenant',
        nit: '000000000',
        dv: '0',
        enabled: true,
        environment: 'habilitacion'
      });
      await tenantRepo.save(tenant);
    }

    let user = await userRepo.findOneBy({ email: 'superadmin@system.com' });
    if (!user) {
      user = userRepo.create({
        id: require("uuid").v4(),
        tenant,
        email: 'superadmin@system.com',
        hashedPassword,
        fullName: 'Super Admin',
        role: 'super_admin',
        isActive: true
      });
      await userRepo.save(user);
    }

    await queryRunner.commitTransaction();
    
    // Run catalogs seed outside this tenant transaction
    await seedCatalogs(dataSource);

    console.log("Seed completed successfully");
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error("Seed failed:", err);
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
