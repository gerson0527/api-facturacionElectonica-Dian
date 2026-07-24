require('dotenv').config();
const { DataSource } = require('typeorm');
const { Invoice } = require('./dist/database/entities/invoice.entity');

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'api_facturacion',
    entities: [Invoice],
    synchronize: false,
    logging: true,
  });
  await ds.initialize();
  
  try {
    const tenantId = '3b86929c-e7f3-4437-ab73-fe8774820d23';
    
    // Test 1: createQueryBuilder
    console.log('Test 1: createQueryBuilder with i.tenantId');
    try {
      const result = await ds
        .createQueryBuilder(Invoice, 'i')
        .where('i.tenantId = :tenantId', { tenantId })
        .getManyAndCount();
      console.log('  OK:', result[1], 'invoices');
    } catch (e) {
      console.log('  FAIL:', e.message);
    }
    
    // Test 2: find with where
    console.log('Test 2: find with {tenantId}');
    try {
      const result = await ds.getRepository(Invoice).find({ where: { tenantId } });
      console.log('  OK:', result.length, 'invoices');
    } catch (e) {
      console.log('  FAIL:', e.message);
    }
  } finally {
    await ds.destroy();
  }
}
main().catch(e => { console.error('ERROR:', e); process.exit(1); });
