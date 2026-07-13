import { DataSource } from "typeorm";
import { CatalogItem } from "../entities/catalog-item.entity";

export async function seedCatalogs(dataSource: DataSource) {
  const repository = dataSource.getRepository(CatalogItem);

  const catalogs = [
    // Tipos de Documento
    { catalogType: "DOCUMENT_TYPE", code: "11", name: "Registro civil", description: "Registro civil" },
    { catalogType: "DOCUMENT_TYPE", code: "12", name: "Tarjeta de identidad", description: "Tarjeta de identidad" },
    { catalogType: "DOCUMENT_TYPE", code: "13", name: "Cédula de ciudadanía", description: "Cédula de ciudadanía" },
    { catalogType: "DOCUMENT_TYPE", code: "21", name: "Tarjeta de extranjería", description: "Tarjeta de extranjería" },
    { catalogType: "DOCUMENT_TYPE", code: "22", name: "Cédula de extranjería", description: "Cédula de extranjería" },
    { catalogType: "DOCUMENT_TYPE", code: "31", name: "NIT", description: "NIT" },
    { catalogType: "DOCUMENT_TYPE", code: "41", name: "Pasaporte", description: "Pasaporte" },
    { catalogType: "DOCUMENT_TYPE", code: "42", name: "Documento de identificación extranjero", description: "Documento de identificación extranjero" },
    { catalogType: "DOCUMENT_TYPE", code: "50", name: "NIT de otro país", description: "NIT de otro país" },
    { catalogType: "DOCUMENT_TYPE", code: "91", name: "NUIP", description: "NUIP" },

    // Impuestos (Tributos)
    { catalogType: "TAX", code: "01", name: "IVA", description: "Impuesto sobre las Ventas" },
    { catalogType: "TAX", code: "02", name: "IC", description: "Impuesto al Consumo" },
    { catalogType: "TAX", code: "03", name: "ICA", description: "Impuesto de Industria y Comercio" },
    { catalogType: "TAX", code: "04", name: "INC", description: "Impuesto Nacional al Consumo" },
    { catalogType: "TAX", code: "05", name: "ReteIVA", description: "Retención sobre el IVA" },
    { catalogType: "TAX", code: "06", name: "ReteFuente", description: "Retención en la Fuente por Renta" },
    { catalogType: "TAX", code: "07", name: "ReteICA", description: "Retención por ICA" },
    { catalogType: "TAX", code: "08", name: "ICUI", description: "Impuesto al Consumo de Bolsas Plásticas" },
    { catalogType: "TAX", code: "20", name: "FPP", description: "Fondo de Quinas y Panela" },
    { catalogType: "TAX", code: "21", name: "Timbre", description: "Impuesto de Timbre" },
    { catalogType: "TAX", code: "22", name: "INC Bebidas Azucaradas", description: "Impuesto Nacional al Consumo de Bebidas Azucaradas" },
    { catalogType: "TAX", code: "23", name: "INC Ultraprocesados", description: "Impuesto Nacional al Consumo de Productos Comestibles Ultraprocesados" },

    // Tipos de Factura (InvoiceType)
    { catalogType: "INVOICE_TYPE", code: "01", name: "Factura de venta", description: "Factura de Venta" },
    { catalogType: "INVOICE_TYPE", code: "02", name: "Factura de exportación", description: "Factura de exportación" },
    { catalogType: "INVOICE_TYPE", code: "03", name: "Factura por talonario", description: "Factura por talonario o de papel" },
    { catalogType: "INVOICE_TYPE", code: "04", name: "Factura de venta (Tipo 04)", description: "Factura electrónica de venta - contingencia facturador" },

    // Nota Crédito (CreditNoteType)
    { catalogType: "CREDIT_NOTE_TYPE", code: "91", name: "Nota Crédito", description: "Nota Crédito" },

    // Nota Débito (DebitNoteType)
    { catalogType: "DEBIT_NOTE_TYPE", code: "92", name: "Nota Débito", description: "Nota Débito" },

    // Formas de Pago
    { catalogType: "PAYMENT_FORM", code: "1", name: "Contado", description: "Contado" },
    { catalogType: "PAYMENT_FORM", code: "2", name: "Crédito", description: "Crédito" },

    // Medios de Pago (Payment Method)
    { catalogType: "PAYMENT_METHOD", code: "10", name: "Efectivo", description: "Efectivo" },
    { catalogType: "PAYMENT_METHOD", code: "42", name: "Consignación bancaria", description: "Consignación bancaria" },
    { catalogType: "PAYMENT_METHOD", code: "47", name: "Transferencia Débito Bancaria", description: "Transferencia Débito Bancaria" },
    { catalogType: "PAYMENT_METHOD", code: "48", name: "Tarjeta Crédito", description: "Tarjeta Crédito" },
    { catalogType: "PAYMENT_METHOD", code: "49", name: "Tarjeta Débito", description: "Tarjeta Débito" },
  ];

  for (const item of catalogs) {
    const exists = await repository.findOne({
      where: { catalogType: item.catalogType, code: item.code },
    });

    if (!exists) {
      await repository.save(repository.create(item));
    }
  }

  console.log("Catalogs seeded successfully");
}
