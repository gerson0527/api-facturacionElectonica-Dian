import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { IdempotencyService } from "../src/services/idempotency.service";
import { Invoice } from "../src/database/entities/invoice.entity";
import { Tenant } from "../src/database/entities/tenant.entity";
import { Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { v4 as uuidv4 } from "uuid";

describe("Concurrency Tests Base", () => {
  let app: INestApplication;
  let idempotencyService: IdempotencyService;
  let invoiceRepo: Repository<Invoice>;
  let tenantRepo: Repository<Tenant>;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    idempotencyService = moduleFixture.get<IdempotencyService>(IdempotencyService);
    invoiceRepo = moduleFixture.get<Repository<Invoice>>(getRepositoryToken(Invoice));
    tenantRepo = moduleFixture.get<Repository<Tenant>>(getRepositoryToken(Tenant));

    const tenant = tenantRepo.create({
      name: "Concurrency Corp",
      nit: `900${Date.now()}`,
      dv: "1",
    });
    const savedTenant = await tenantRepo.save(tenant);
    tenantId = savedTenant.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("should handle concurrent insertions using executeWithIdempotency", async () => {
    const idempotencyKey = uuidv4();
    const payload = { test: true, random: Math.random() };
    const action = async (hash: string, manager: any) => {
      // simulate delay to force race condition
      await new Promise(resolve => setTimeout(resolve, 50));
      const invoice = manager.create(Invoice, {
        tenant: { id: tenantId },
        number: `TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        invoiceType: "01",
        paymentFormCode: "1",
        paymentMethodCode: "10",
        issueDate: new Date(),
        customerId: undefined,
        customerName: "Test Customer",
        customerDocument: "123456789",
        customerDocumentType: "13",
        subtotal: 100,
        totalTax: 19,
        totalAmount: 119,
        status: "draft",
        cufe: `CUFE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        qrCode: "test",
        idempotencyKey,
        requestPayloadHash: hash,
        responseStatusCode: 201,
      });
      const saved = await manager.save(invoice);
      await manager.update(Invoice, saved.id, { responseSnapshot: saved as any });
      return { snapshot: saved, statusCode: 201 };
    };

    const promises = Array.from({ length: 10 }).map(() =>
      idempotencyService.executeWithIdempotency(tenantId, idempotencyKey, payload, invoiceRepo, action)
    );

    const results = await Promise.allSettled(promises);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    if (rejected.length > 0) {
      console.error((rejected[0] as any).reason);
    }

    // All should be successful
    expect(fulfilled.length).toBe(10);
    expect(rejected.length).toBe(0);

    // They should all return the same exact invoice (only 1 was inserted)
    const firstInvoiceId = (fulfilled[0] as any).value.snapshot.id;
    for (const res of fulfilled) {
      expect((res as any).value.snapshot.id).toBe(firstInvoiceId);
    }
    
    // DB check
    const count = await invoiceRepo.count({ where: { tenantId, idempotencyKey } });
    expect(count).toBe(1);
  });
});
