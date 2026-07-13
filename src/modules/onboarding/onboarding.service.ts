import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DianSoftwareCredential } from "@/database/entities/dian-software-credential.entity";
import { CustomersService } from "@/modules/customers/customers.service";
import { InvoicesService } from "@/modules/invoices/invoices.service";
import { CreditNotesService } from "@/modules/credit-notes/credit-notes.service";
import { DebitNotesService } from "@/modules/debit-notes/debit-notes.service";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectRepository(DianSoftwareCredential)
    private readonly softwareCredsRepo: Repository<DianSoftwareCredential>,
    private readonly customersService: CustomersService,
    private readonly invoicesService: InvoicesService,
    private readonly creditNotesService: CreditNotesService,
    private readonly debitNotesService: DebitNotesService,
  ) {}

  async triggerTestSet(tenantId: string, testSetId: string, userId: string) {
    // 1. Update TestSetId
    const creds = await this.softwareCredsRepo.findOne({ where: { tenant: { id: tenantId } } });
    if (!creds) {
      throw new NotFoundException("Credenciales de software no encontradas para el tenant");
    }
    creds.testSetId = testSetId;
    await this.softwareCredsRepo.save(creds);

    this.logger.log(`Iniciando Auto-Onboarding para Tenant ${tenantId} con TestSetId ${testSetId}`);

    // 2. Ensure dummy customer exists
    let customer;
    const existingCustomers = await this.customersService.findByTenant(tenantId);
    if (existingCustomers.length > 0) {
      customer = existingCustomers[0];
    } else {
      customer = await this.customersService.create(tenantId, {
        documentType: "13", // CC
        documentNumber: "123456789",
        name: "Adquiriente de Pruebas",
        email: "pruebas@facturacion.local",
        address: "Calle Falsa 123",
        phone: "5555555",
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const generatedInvoices = [];

    // 3. Generate 8 Invoices
    for (let i = 1; i <= 8; i++) {
      const invoice = await this.invoicesService.create(tenantId, {
        idempotencyKey: uuidv4(),
        issueDate: today,
        customerId: customer.id,
        prefix: "SETP", // commonly used for test sets
        invoiceType: "01",
        paymentFormCode: "1",
        paymentMethodCode: "10",
        lines: [
          {
            lineNumber: 1,
            description: `Producto de Prueba ${i}`,
            quantity: 1,
            unitPrice: 100000,
            unitCode: "94", // Unidad genérica
            taxCode: "01", // IVA
            taxPercent: 19,
            taxAmount: 19000,
            lineExtensionAmount: 100000,
          }
        ],
        taxTotals: [
          {
            taxId: "01",
            taxPercent: 19,
            taxableAmount: 100000,
            taxAmount: 19000,
          }
        ]
      }, userId);
      generatedInvoices.push(invoice);
    }

    // 4. Generate 1 Credit Note (associated to the 1st invoice)
    await this.creditNotesService.create(generatedInvoices[0].id, {
      idempotencyKey: uuidv4(),
      issueDate: today,
      reasonCode: "1", // Devolución de parte de los bienes
      totalAmount: 50000, // Partial credit
      prefix: "NCSETP",
      description: "Nota Crédito de Prueba Habilitación"
    });

    // 5. Generate 1 Debit Note (associated to the 2nd invoice)
    await this.debitNotesService.create(generatedInvoices[1].id, {
      idempotencyKey: uuidv4(),
      issueDate: today,
      reasonCode: "1", // Intereses
      totalAmount: 10000,
      prefix: "NDSETP",
      description: "Nota Débito de Prueba Habilitación"
    });

    this.logger.log(`Set de Pruebas generado y encolado exitosamente para Tenant ${tenantId}`);

    return {
      success: true,
      message: "Set de pruebas (8 Facturas, 1 NC, 1 ND) encolado para transmisión",
      testSetId,
      invoicesCount: generatedInvoices.length,
    };
  }
}
