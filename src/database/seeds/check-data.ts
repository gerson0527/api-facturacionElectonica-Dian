import { DataSource } from "typeorm";
import { dataSourceOptions } from "../../config/database.config";

const TENANT_ID = "87e74b5a-77a2-432f-9c5e-cfe3eb2b0bab";

async function check() {
  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();

  const customers = await ds.query("SELECT COUNT(*) as count, MAX(\"createdAt\") as last FROM customers WHERE tenant_id = $1", [TENANT_ID]);
  const products = await ds.query("SELECT COUNT(*) as count FROM products WHERE tenant_id = $1", [TENANT_ID]);
  const suppliers = await ds.query("SELECT COUNT(*) as count FROM suppliers WHERE tenant_id = $1", [TENANT_ID]);
  const movements = await ds.query("SELECT COUNT(*) as count FROM inventory_movements WHERE tenant_id = $1", [TENANT_ID]);
  const invoices = await ds.query("SELECT COUNT(*) as count, MAX(number) as last_num FROM invoices WHERE tenant_id = $1", [TENANT_ID]);
  const payments = await ds.query("SELECT COUNT(*) as count FROM payments WHERE tenant_id = $1", [TENANT_ID]);

  console.log("\n=== DATOS ACTUALES EN DB (tenant gersongio0527) ===");
  console.log(`Clientes:    ${customers[0].count} (último creado: ${customers[0].last})`);
  console.log(`Productos:   ${products[0].count}`);
  console.log(`Proveedores: ${suppliers[0].count}`);
  console.log(`Movimientos: ${movements[0].count}`);
  console.log(`Facturas:    ${invoices[0].count} (último número: FE-${invoices[0].last_num})`);
  console.log(`Pagos:       ${payments[0].count}`);

  const recentCustomers = await ds.query(`
    SELECT "document_number", name, email
    FROM customers
    WHERE tenant_id = $1
    ORDER BY "createdAt" DESC
    LIMIT 10
  `, [TENANT_ID]);
  console.log("\n=== ÚLTIMOS 10 CLIENTES ===");
  recentCustomers.forEach((c: any) => console.log(`  ${c.document_number} - ${c.name} (${c.email})`));

  await ds.destroy();
}

check().catch(e => { console.error(e); process.exit(1); });
