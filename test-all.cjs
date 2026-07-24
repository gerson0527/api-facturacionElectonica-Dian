require('dotenv').config();
const { DataSource } = require('typeorm');
const entities = require('./dist/database/entities');

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'api_facturacion',
    entities: Object.values(entities).filter(
      (e) => typeof e === 'function' && !!e.name && /^[A-Z]/.test(e.name) && !['MovementType', 'QuotationStatus'].includes(e.name),
    ),
    synchronize: false,
    logging: false,
  });
  try {
    await ds.initialize();
    console.log('SUCCESS - all entities loaded');
    
    const repo = ds.getRepository('Invoice');
    console.log('Invoice repository:', !!repo);
    
    const result = await repo
      .createQueryBuilder('i')
      .where('i.tenantId = :tid', { tid: '3b86929c-e7f3-4437-ab73-fe8774820d23' })
      .getManyAndCount();
    console.log('Query result:', result[1], 'invoices');
    
    await ds.destroy();
  } catch (e) {
    console.error('ERROR:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}
main();