import { DataSource } from "typeorm";
import { dataSourceOptions } from "../../config/database.config";
import { v4 as uuidv4 } from "uuid";

const TENANT_ID = "87e74b5a-77a2-432f-9c5e-cfe3eb2b0bab";
const USER_ID = "5815a0a4-36ce-4d40-9d35-d09989ad3a0f";

const COLOMBIAN_DIAN_PAYMENT_METHODS: Record<string, string> = {
  "Efectivo": "10",
  "Transferencia": "31",
  "Nequi": "31",
  "Daviplata": "31",
  "Tarjeta Crédito": "48",
  "Tarjeta Débito": "49",
};

async function runSeed() {
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.startTransaction();
    const tenant = { id: TENANT_ID } as any;
    const userId = USER_ID;

    const productRepo = queryRunner.manager.getRepository("Product");
    const supplierRepo = queryRunner.manager.getRepository("Supplier");
    const customerRepo = queryRunner.manager.getRepository("Customer");
    const movementRepo = queryRunner.manager.getRepository("InventoryMovement");
    const invoiceRepo = queryRunner.manager.getRepository("Invoice");
    const lineRepo = queryRunner.manager.getRepository("InvoiceLine");
    const paymentRepo = queryRunner.manager.getRepository("Payment");

    // ============ 1. PROVEEDORES ============
    console.log("→ Creando proveedores...");
    const suppliersData: any[] = [
      { documentType: "31", documentNumber: "800123456", dv: "7", name: "Distribuidora Nacional S.A.S", address: "Cra 15 # 100-50 Bogotá", phone: "+57 601 5551234", email: "ventas@distnacional.com" },
      { documentType: "31", documentNumber: "900456789", dv: "3", name: "Importaciones del Valle Ltda", address: "Cl 5 # 80-15 Cali", phone: "+57 602 3334455", email: "contacto@impvalle.co" },
      { documentType: "31", documentNumber: "830111222", dv: "1", name: "Tecnología Andina S.A", address: "Av 68 # 75-50 Bogotá", phone: "+57 601 7778899", email: "pedidos@tecandina.com" },
      { documentType: "31", documentNumber: "900222333", dv: "9", name: "Alimentos Premium Colombia", address: "Cra 50 # 12-30 Medellín", phone: "+57 604 4445566", email: "gerencia@alipremium.com" },
      { documentType: "31", documentNumber: "860333444", dv: "5", name: "Papelería El Carmen S.A.S", address: "Cl 12 # 8-45 Pereira", phone: "+57 606 3337788", email: "ventas@papelcarmen.co" },
    ];

    const suppliers: any[] = [];
    for (const s of suppliersData) {
      const exists = await supplierRepo.findOne({ where: { tenantId: TENANT_ID, documentNumber: s.documentNumber } as any });
      if (exists) { suppliers.push(exists); continue; }
      const created = supplierRepo.create({ ...s, tenantId: TENANT_ID });
      const saved = await supplierRepo.save(created);
      suppliers.push(saved);
    }

    // ============ 2. PRODUCTOS ============
    console.log("→ Creando productos...");
    const productsData: any[] = [
      { code: "P001", name: "Laptop HP Pavilion 15", description: "Portátil 15.6\" Core i5 8GB RAM 512GB SSD", price: 2850000, taxRate: 19, stock: 15, unitOfMeasure: "94" },
      { code: "P002", name: "Mouse Inalámbrico Logitech MX Master 3", description: "Mouse ergonómico Bluetooth", price: 285000, taxRate: 19, stock: 45, unitOfMeasure: "94" },
      { code: "P003", name: "Teclado Mecánico RGB", description: "Switches azules, layout español", price: 320000, taxRate: 19, stock: 28, unitOfMeasure: "94" },
      { code: "P004", name: "Monitor Samsung 27\" 4K", description: "Resolución 3840x2160, HDMI/DP", price: 1450000, taxRate: 19, stock: 12, unitOfMeasure: "94" },
      { code: "P005", name: "Audífonos Sony WH-1000XM5", description: "Cancelación de ruido, inalámbricos", price: 1180000, taxRate: 19, stock: 22, unitOfMeasure: "94" },
      { code: "P006", name: "Webcam Logitech C920", description: "Full HD 1080p, micrófono integrado", price: 380000, taxRate: 19, stock: 35, unitOfMeasure: "94" },
      { code: "P007", name: "Disco SSD 1TB NVMe", description: "Lectura 3500MB/s, escritura 3000MB/s", price: 425000, taxRate: 19, stock: 50, unitOfMeasure: "94" },
      { code: "P008", name: "Café Premium 500g", description: "Café de origen colombiano, tostado medio", price: 28000, taxRate: 5, stock: 120, unitOfMeasure: "94" },
      { code: "P009", name: "Cuaderno Profesional A4", description: "100 hojas, rayado, tapa dura", price: 14500, taxRate: 5, stock: 200, unitOfMeasure: "94" },
      { code: "P010", name: "Resma Papel Bond 75g", description: "500 hojas tamaño carta", price: 19500, taxRate: 5, stock: 85, unitOfMeasure: "94" },
      { code: "P011", name: "Bolígrafo Azul Caja x12", description: "Punta media 1.0mm, tinta azul", price: 8500, taxRate: 5, stock: 150, unitOfMeasure: "94" },
      { code: "P012", name: "Esfero Negro Caja x12", description: "Punta media 1.0mm, tinta negra", price: 8500, taxRate: 5, stock: 130, unitOfMeasure: "94" },
      { code: "P013", name: "Calculadora Científica", description: "Pantalla LCD, 240 funciones", price: 65000, taxRate: 19, stock: 28, unitOfMeasure: "94" },
      { code: "P014", name: "Carpetas Legajadoras x10", description: "Tamaño oficio, cartón prensado", price: 32000, taxRate: 5, stock: 60, unitOfMeasure: "94" },
      { code: "P015", name: "Cable HDMI 2m", description: "4K@60Hz, alta velocidad", price: 28000, taxRate: 19, stock: 75, unitOfMeasure: "94" },
    ];

    const products: any[] = [];
    for (const p of productsData) {
      const exists = await productRepo.findOne({ where: { tenantId: TENANT_ID, code: p.code } as any });
      if (exists) { products.push(exists); continue; }
      const created = productRepo.create({ ...p, tenantId: TENANT_ID });
      const saved = await productRepo.save(created);
      products.push(saved);
    }

    // ============ 3. CLIENTES ============
    console.log("→ Creando clientes...");
    const customersData: any[] = [
      { documentType: "31", documentNumber: "800555111", dv: "1", name: "Constructora Horizonte S.A.S", address: "Cl 100 # 15-20 Bogotá", phone: "+57 601 7001122", email: "compras@horizonte.co", municipalityCode: "11001", fiscalResponsibilities: ["O-13", "O-15"] },
      { documentType: "13", documentNumber: "79456123", dv: null as any, name: "Juan Carlos Pérez Mendoza", address: "Cl 45 # 12-34 Bogotá", phone: "+57 311 555 1234", email: "jcperez@gmail.com", municipalityCode: "11001", fiscalResponsibilities: ["R-99-PN"] },
      { documentType: "31", documentNumber: "901234567", dv: "8", name: "Innovación Digital S.A", address: "Cra 7 # 71-21 Bogotá", phone: "+57 601 3124567", email: "finanzas@inndigital.com", municipalityCode: "11001", fiscalResponsibilities: ["O-13", "O-15", "O-23"] },
      { documentType: "13", documentNumber: "52345678", dv: null as any, name: "María Fernanda López", address: "Cra 13 # 85-32 Bogotá", phone: "+57 320 888 9988", email: "mafer.lopez@hotmail.com", municipalityCode: "11001", fiscalResponsibilities: ["R-99-PN"] },
      { documentType: "31", documentNumber: "800999000", dv: "2", name: "Restaurante Sazón Real Ltda", address: "Cl 19 # 5-45 Bogotá", phone: "+57 601 3332233", email: "admin@sazonreal.co", municipalityCode: "11001", fiscalResponsibilities: ["O-13", "O-15"] },
      { documentType: "13", documentNumber: "1022345678", dv: null as any, name: "Carlos Andrés Ramírez", address: "Cl 80 # 8-12 Bogotá", phone: "+57 315 777 6655", email: "carlos.ramirez@gmail.com", municipalityCode: "11001", fiscalResponsibilities: ["R-99-PN"] },
      { documentType: "31", documentNumber: "900777888", dv: "4", name: "Logística Express del Sur S.A.S", address: "Cra 68 # 22-30 Bogotá", phone: "+57 601 4223344", email: "operaciones@logexsur.co", municipalityCode: "11001", fiscalResponsibilities: ["O-13", "O-15"] },
      { documentType: "13", documentNumber: "79123456", dv: null as any, name: "Andrés Felipe Torres Vargas", address: "Cl 22 # 14-55 Bogotá", phone: "+57 316 444 3322", email: "aftorres@gmail.com", municipalityCode: "11001", fiscalResponsibilities: ["R-99-PN"] },
      { documentType: "31", documentNumber: "830888999", dv: "7", name: "Clínica Dental Sonrisa Perfecta", address: "Cra 15 # 87-21 Bogotá", phone: "+57 601 6445566", email: "contabilidad@sonrisaperfecta.co", municipalityCode: "11001", fiscalResponsibilities: ["O-13", "O-15"] },
      { documentType: "13", documentNumber: "80123456", dv: null as any, name: "Diana Carolina Méndez", address: "Cl 50 # 6-30 Bogotá", phone: "+57 312 666 5544", email: "dc.mendez@gmail.com", municipalityCode: "11001", fiscalResponsibilities: ["R-99-PN"] },
    ];

    const customers: any[] = [];
    for (const c of customersData) {
      const exists = await customerRepo.findOne({ where: { tenantId: TENANT_ID, documentNumber: c.documentNumber } as any });
      if (exists) { customers.push(exists); continue; }
      const created = customerRepo.create({ ...c, tenantId: TENANT_ID });
      const saved = await customerRepo.save(created);
      customers.push(saved);
    }

    // ============ 4. MOVIMIENTOS DE INVENTARIO (entrada inicial) ============
    console.log("→ Creando movimientos de inventario (entradas)...");
    const movementsData: any[] = [];
    for (const product of products) {
      // Cada producto tiene 2-3 entradas históricas
      const numMovs = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < numMovs; i++) {
        const daysAgo = (i + 1) * 14;
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        movementsData.push({
          type: "IN" as const,
          productId: product.id,
          quantity: Math.floor(product.stock * (0.3 + Math.random() * 0.4)),
          reason: i === 0 ? "Compra inicial" : `Reposición de stock`,
          reference: `OC-${1000 + Math.floor(Math.random() * 100)}`,
          createdAt: date,
        });
      }
    }
    // Varias salidas recientes
    for (let i = 0; i < 8; i++) {
      const prod = products[Math.floor(Math.random() * products.length)];
      const daysAgo = Math.floor(Math.random() * 5) + 1;
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      movementsData.push({
        type: "OUT" as const,
        productId: prod.id,
        quantity: Math.floor(Math.random() * 3) + 1,
        reason: "Venta POS",
        reference: `POS-${Date.now()}-${i}`,
        createdAt: date,
      });
    }

    for (const m of movementsData) {
      const existing = await movementRepo.findOne({ where: { reference: m.reference } as any });
      if (existing) continue;
      const created = movementRepo.create({ ...m, tenantId: TENANT_ID });
      await movementRepo.save(created);
    }

    // ============ 5. FACTURAS DE LOS ÚLTIMOS 30 DÍAS ============
    console.log("→ Creando facturas de los últimos 30 días...");
    const createdInvoices: any[] = [];
    const today = new Date();

    // Generar 1-3 facturas por día durante los últimos 30 días
    for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
      const invoicesToday = Math.random() < 0.3 ? 0 : Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < invoicesToday; i++) {
        const issueDate = new Date(today);
        issueDate.setDate(issueDate.getDate() - dayOffset);
        issueDate.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);

        const customer = customers[Math.floor(Math.random() * customers.length)];
        const numLines = Math.floor(Math.random() * 3) + 1;
        const selectedProducts: any[] = [];
        for (let j = 0; j < numLines; j++) {
          const p = products[Math.floor(Math.random() * products.length)];
          if (!selectedProducts.find(sp => sp.id === p.id)) selectedProducts.push(p);
        }

        let subtotal = 0;
        let totalTax = 0;
        const lines = selectedProducts.map((p, idx) => {
          const qty = Math.floor(Math.random() * 3) + 1;
          const unitPrice = Number(p.price);
          const lineExt = +(qty * unitPrice).toFixed(2);
          const taxAmount = +(lineExt * (Number(p.taxRate) / 100)).toFixed(2);
          subtotal += lineExt;
          totalTax += taxAmount;
          return {
            lineNumber: idx + 1,
            description: p.name,
            quantity: qty,
            unitCode: p.unitOfMeasure || "94",
            unitPrice: unitPrice,
            lineExtensionAmount: lineExt,
            taxAmount: taxAmount,
            taxPercent: Number(p.taxRate),
            taxCode: "01",
            invoiceId: "",
          };
        });
        const total = +(subtotal + totalTax).toFixed(2);

        // Status aleatorio
        const r = Math.random();
        let status = "accepted";
        if (r < 0.08) status = "rejected";
        else if (r < 0.18) status = "pending";
        else if (r < 0.25) status = "draft";

        // Método de pago aleatorio
        const paymentMethods = ["10", "31", "48", "49"];
        const paymentMethodCode = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

        const idemKey = uuidv4();
        // Calcular el siguiente número de factura disponible en el tenant
        const lastInvoice = await invoiceRepo
          .createQueryBuilder("inv")
          .where("inv.tenant_id = :tid AND inv.prefix = :p", { tid: TENANT_ID, p: "FE" })
          .orderBy("inv.number", "DESC")
          .getOne();
        const lastNumber = lastInvoice ? parseInt(lastInvoice.number, 10) : 1000;
        const invoiceNumber = String(lastNumber + createdInvoices.length + 1).padStart(6, "0");
        const invoice = invoiceRepo.create({
          prefix: "FE",
          number: invoiceNumber,
          invoiceType: "01",
          paymentFormCode: "1",
          paymentMethodCode,
          issueDate: issueDate,
          customerId: customer.id,
          customerName: customer.name,
          customerDocument: customer.documentNumber,
          customerDocumentType: customer.documentType,
          subtotal: +subtotal.toFixed(2),
          totalTax: +totalTax.toFixed(2),
          totalAmount: total,
          status,
          cufe: status === "accepted" ? "cufe-" + uuidv4().replace(/-/g, "").slice(0, 96) : null,
          idempotencyKey: idemKey,
          tenantId: TENANT_ID,
        });
        const savedInvoice: any = await invoiceRepo.save(invoice);
        for (const l of lines) {
          l.invoiceId = savedInvoice.id;
          const lineEntity = lineRepo.create({ ...l, tenantId: TENANT_ID });
          await lineRepo.save(lineEntity);
        }
        createdInvoices.push(savedInvoice);
      }
    }

    // ============ 6. PAGOS ============
    console.log("→ Creando pagos...");
    const methodNames: Record<string, string> = {
      "10": "Efectivo",
      "31": "Transferencia",
      "48": "Tarjeta Crédito",
      "49": "Tarjeta Débito",
    };
    let globalPayCounter = 0;

    for (const invoice of createdInvoices) {
      if (invoice.status === "rejected" || invoice.status === "draft") continue;
      // Algunos pagos parciales (solo 10%)
      if (Math.random() < 0.1) continue;
      const methodCode = invoice.paymentMethodCode;
      globalPayCounter += 1;
      const payment = paymentRepo.create({
        paymentNumber: `PAY-${Date.now().toString(36).toUpperCase()}-${globalPayCounter}`,
        invoiceId: invoice.id,
        amount: Number(invoice.totalAmount),
        method: methodCode,
        paymentDate: invoice.issueDate,
        status: "Aprobado",
        notes: `Pago de factura ${invoice.prefix}-${invoice.number} vía ${methodNames[methodCode]}`,
        tenantId: TENANT_ID,
      });
      await paymentRepo.save(payment);
    }

    await queryRunner.commitTransaction();
    console.log("\n✅ Seed completado exitosamente:");
    console.log(`   • ${suppliers.length} proveedores`);
    console.log(`   • ${products.length} productos`);
    console.log(`   • ${customers.length} clientes`);
    console.log(`   • ${movementsData.length} movimientos de inventario`);
    console.log(`   • ${createdInvoices.length} facturas`);
    console.log(`   • ${globalPayCounter} pagos`);
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error("❌ Seed falló:", err);
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

