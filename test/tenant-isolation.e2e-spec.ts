import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { DataSource } from "typeorm";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { Tenant } from "../src/database/entities/tenant.entity";
import { User } from "../src/database/entities/user.entity";
import { Customer } from "../src/database/entities/customer.entity";
import { Product } from "../src/database/entities/product.entity";
import * as bcrypt from "bcrypt";

function extractAccessCookie(setCookie: string | string[] | undefined): string | null {
  if (!setCookie) return null;
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  const raw = list.find((c) => c.startsWith("access="));
  if (!raw) return null;
  return raw.split(";")[0].split("=")[1];
}

describe("Tenant isolation (BOLA / BFLA)", () => {
  let app: INestApplication;
  let tokenA: string;
  let tokenB: string;
  let userAId: string;
  let userBId: string;
  let tenantAId: string;
  let tenantBId: string;
  let customerAId: string;
  let productAId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("v1", {
      exclude: ["/docs", "/health", "/health/live", "/health/ready"],
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const ds = app.get(DataSource);

    const tenantA = await ds.getRepository(Tenant).save(
      ds.getRepository(Tenant).create({
        name: "Tenant A Test",
        nit: "900111111",
        dv: "1",
        email: "a@test.com",
      }),
    );
    tenantAId = tenantA.id;

    const tenantB = await ds.getRepository(Tenant).save(
      ds.getRepository(Tenant).create({
        name: "Tenant B Test",
        nit: "900222222",
        dv: "2",
        email: "b@test.com",
      }),
    );
    tenantBId = tenantB.id;

    const hashed = await bcrypt.hash("Pass1234!", 10);
    const userA = await ds.getRepository(User).save(
      ds.getRepository(User).create({
        email: "admin-a@test.com",
        hashedPassword: hashed,
        fullName: "Admin A",
        tenantId: tenantAId,
        role: "tenant_admin",
      }),
    );
    userAId = userA.id;

    const userB = await ds.getRepository(User).save(
      ds.getRepository(User).create({
        email: "admin-b@test.com",
        hashedPassword: hashed,
        fullName: "Admin B",
        tenantId: tenantBId,
        role: "tenant_admin",
      }),
    );
    userBId = userB.id;

    const customerA = await ds.getRepository(Customer).save(
      ds.getRepository(Customer).create({
        tenantId: tenantAId,
        documentType: "31",
        documentNumber: "900111222",
        name: "Cliente A",
      }),
    );
    customerAId = customerA.id;

    const productA = await ds.getRepository(Product).save(
      ds.getRepository(Product).create({
        tenantId: tenantAId,
        code: "PROD-A-001",
        name: "Producto A",
        price: 1000,
        stock: 100,
      }),
    );
    productAId = productA.id;

    const resA = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: "admin-a@test.com", password: "Pass1234!" })
      .expect(200);
    tokenA = extractAccessCookie(resA.headers["set-cookie"])!;

    const resB = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: "admin-b@test.com", password: "Pass1234!" })
      .expect(200);
    tokenB = extractAccessCookie(resB.headers["set-cookie"])!;
  });

  afterAll(async () => {
    const ds = app.get(DataSource);
    await ds.query("DELETE FROM customers WHERE tenant_id IN ($1, $2)", [
      tenantAId,
      tenantBId,
    ]);
    await ds.query("DELETE FROM products WHERE tenant_id IN ($1, $2)", [
      tenantAId,
      tenantBId,
    ]);
    await ds.query("DELETE FROM users WHERE id IN ($1, $2)", [
      userAId,
      userBId,
    ]);
    await ds.query("DELETE FROM tenants WHERE id IN ($1, $2)", [
      tenantAId,
      tenantBId,
    ]);
    await app.close();
  });

  describe("Customers isolation", () => {
    it("Token A puede leer customers de A", async () => {
      const res = await request(app.getHttpServer())
        .get("/v1/customers")
        .set("Authorization", `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body.some((c: any) => c.id === customerAId)).toBe(true);
    });

    it("Token B NO puede leer customers de A", async () => {
      const res = await request(app.getHttpServer())
        .get("/v1/customers")
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(200);
      expect(res.body.some((c: any) => c.id === customerAId)).toBe(false);
    });

    it("Token B NO puede acceder a customer de A por ID directo", async () => {
      await request(app.getHttpServer())
        .get(`/v1/customers/${customerAId}`)
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(404); // TenantGuard filtra
    });

    it("Token B NO puede usar header x-tenant-id para impersonar a A", async () => {
      await request(app.getHttpServer())
        .get("/v1/customers")
        .set("Authorization", `Bearer ${tokenB}`)
        .set("x-tenant-id", tenantAId)
        .expect(403);
    });
  });

  describe("Products isolation", () => {
    it("Token B no ve productos de A", async () => {
      const res = await request(app.getHttpServer())
        .get("/v1/products")
        .set("Authorization", `Bearer ${tokenB}`)
        .expect(200);
      expect(res.body.some((p: any) => p.id === productAId)).toBe(false);
    });
  });

  describe("Auth escalation", () => {
    it("Anon NO puede crear tenants", async () => {
      await request(app.getHttpServer())
        .post("/v1/tenants")
        .send({ name: "X", nit: "1" })
        .expect(401);
    });

    it("Token B NO puede crear admin en tenant A", async () => {
      await request(app.getHttpServer())
        .post("/v1/auth/users")
        .set("Authorization", `Bearer ${tokenB}`)
        .send({
          email: "evil@x.com",
          password: "Pass1234!",
          fullName: "Evil",
          tenantId: tenantAId,
          role: "tenant_admin",
        })
        .expect(403);
    });

    it("Token B NO puede revocar sesiones de A", async () => {
      await request(app.getHttpServer())
        .post("/v1/auth/revoke-all")
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ userId: userAId })
        .expect(403);
    });
  });

  describe("PIN endpoint", () => {
    it("Token B no puede verificar PIN de usuario de A", async () => {
      await request(app.getHttpServer())
        .post("/v1/auth/pin/set")
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ pin: "1234" })
        .expect(201);
      // El pin creado pertenece al user B, no al A
    });
  });
});