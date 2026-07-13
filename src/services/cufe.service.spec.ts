import { Test, TestingModule } from "@nestjs/testing";
import { CufeService } from "./cufe.service";

describe("CufeService", () => {
  let service: CufeService;

  const baseInput = {
    numFac: "SETP0000000001",
    fecFac: "2024-01-15",
    horFac: "10:30:00",
    valBruto: "1000000.00",
    valIva: "190000.00",
    valAdicional: "0.00",
    valTotal: "1190000.00",
    nitEmisor: "900123456",
    dvEmisor: "0",
    tipoDocEmisor: "31",
    tipoDocAdquirente: "13",
    numDocAdquirente: "123456789",
    dvAdquirente: "",
    softwarePin: "test-pin-123",
    ambiente: "1",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CufeService],
    }).compile();
    service = module.get<CufeService>(CufeService);
  });

  it("should generate valid SHA-384 CUFE with 96 hex chars", () => {
    const cufe = service.generate(baseInput);
    expect(cufe).toBeDefined();
    expect(cufe.length).toBe(96);
    expect(cufe).toMatch(/^[A-F0-9]{96}$/);
  });

  it("should generate different CUFE for different inputs", () => {
    const cufe1 = service.generate(baseInput);
    const cufe2 = service.generate({ ...baseInput, valTotal: "1200000.00" });
    expect(cufe1).not.toBe(cufe2);
  });

  it("should be sensitive to DV emisor", () => {
    const cufe1 = service.generate(baseInput);
    const cufe2 = service.generate({ ...baseInput, dvEmisor: "5" });
    expect(cufe1).not.toBe(cufe2);
  });

  it("should be sensitive to DV adquirente", () => {
    const cufe1 = service.generate({ ...baseInput, dvAdquirente: "" });
    const cufe2 = service.generate({ ...baseInput, dvAdquirente: "1" });
    expect(cufe1).not.toBe(cufe2);
  });

  it("should be deterministic (same input = same output)", () => {
    const cufe1 = service.generate(baseInput);
    const cufe2 = service.generate(baseInput);
    expect(cufe1).toBe(cufe2);
  });
});
