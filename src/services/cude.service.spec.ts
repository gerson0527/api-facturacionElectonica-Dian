import { Test, TestingModule } from "@nestjs/testing";
import { CudeService, CudeInput } from "./cude.service";
import * as crypto from "crypto";

describe("CudeService", () => {
  let service: CudeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CudeService],
    }).compile();

    service = module.get<CudeService>(CudeService);
  });

  it("should generate a correct CUDE hash", () => {
    const input: CudeInput = {
      numDoc: "NC990000001",
      fecDoc: "2020-01-01",
      horDoc: "12:00:00-05:00",
      valBruto: "100000.00",
      valIva: "19000.00",
      valAdicional: "0.00",
      valTotal: "119000.00",
      nitEmisor: "900123456",
      dvEmisor: "1",
      tipoDocAdquirente: "13",
      numDocAdquirente: "123456789",
      dvAdquirente: "0",
      softwarePin: "12345",
      ambiente: "2",
      docOrigenCufe: "CUFE123456789",
      motivo: "1",
    };

    const concatenated = [
      input.numDoc,
      input.fecDoc,
      input.horDoc,
      input.valBruto,
      input.valIva,
      input.valAdicional,
      input.valTotal,
      input.nitEmisor,
      input.dvEmisor,
      input.tipoDocAdquirente,
      input.numDocAdquirente,
      input.dvAdquirente,
      input.softwarePin,
      input.ambiente,
      input.docOrigenCufe,
      input.motivo,
    ].join("");

    const expectedHash = crypto.createHash("sha384").update(concatenated, "utf8").digest("hex").toUpperCase();

    const cude = service.generate(input);
    expect(cude).toBe(expectedHash);
  });
});
