import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("API Facturación Electrónica (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Add Swagger for /docs test
    const { DocumentBuilder, SwaggerModule } = require("@nestjs/swagger");
    const config = new DocumentBuilder().setTitle("API").setVersion("1.0").build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("docs", app, document);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.setGlobalPrefix("v1", {
      exclude: ["/docs", "/health", "/health/live", "/health/ready"],
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Health / Status", () => {
    it("GET /docs should return Swagger UI", () => {
      return request(app.getHttpServer()).get("/docs").expect(302);
    });
  });

  describe("Auth", () => {
    it("POST /v1/auth/login with invalid credentials should return 401", () => {
      return request(app.getHttpServer())
        .post("/v1/auth/login")
        .send({ email: "nonexistent@test.com", password: "wrong" })
        .expect(401);
    });
  });

  describe("Tenants", () => {
    it("POST /v1/tenants should create a tenant", () => {
      return request(app.getHttpServer())
        .post("/v1/tenants")
        .send({
          name: "E2E Test Corp",
          nit: "999999999",
          dv: "0",
          address: "Test Address",
          phone: "3000000000",
          email: "e2e@test.com",
        })
        .expect(201);
    });
  });
});
