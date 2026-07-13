import { CufeService } from "./cufe.service";

describe("CUFE Algorithm", () => {
  const cufeService = new CufeService();
  const base = {
    numFac: "SETP990000000001",
    fecFac: "2024-06-15",
    horFac: "14:30:00",
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
    softwarePin: "SE3F5G8H2K7M4N9P",
    ambiente: "1",
  };

  it("debe implementar CUFE con 15 campos concatenados sin separadores (Anexo 1.9)", () => {
    const cufe = cufeService.generate(base);
    expect(cufe.length).toBe(96);
    expect(cufe).toMatch(/^[0-9A-F]{96}$/);
  });

  it("debe ser sensible al numero de factura", () => {
    const cufe1 = cufeService.generate({ ...base, numFac: "SETP1" });
    const cufe2 = cufeService.generate({ ...base, numFac: "SETP2" });
    expect(cufe1).not.toBe(cufe2);
  });

  it("debe ser sensible al NIT del emisor", () => {
    const cufe1 = cufeService.generate({ ...base, nitEmisor: "900123456" });
    const cufe2 = cufeService.generate({ ...base, nitEmisor: "800123456" });
    expect(cufe1).not.toBe(cufe2);
  });

  it("debe ser sensible al DV del emisor", () => {
    const cufe1 = cufeService.generate({ ...base, dvEmisor: "0" });
    const cufe2 = cufeService.generate({ ...base, dvEmisor: "1" });
    expect(cufe1).not.toBe(cufe2);
  });

  it("debe ser sensible al DV del adquirente", () => {
    const cufe1 = cufeService.generate({ ...base, dvAdquirente: "" });
    const cufe2 = cufeService.generate({ ...base, dvAdquirente: "5" });
    expect(cufe1).not.toBe(cufe2);
  });

  it("debe ser sensible al software pin", () => {
    const cufe1 = cufeService.generate({ ...base, softwarePin: "PIN-A" });
    const cufe2 = cufeService.generate({ ...base, softwarePin: "PIN-B" });
    expect(cufe1).not.toBe(cufe2);
  });

  it("debe ser sensible al total", () => {
    const cufe1 = cufeService.generate({ ...base, valTotal: "1190000.00" });
    const cufe2 = cufeService.generate({ ...base, valTotal: "1195000.00" });
    expect(cufe1).not.toBe(cufe2);
  });
});
