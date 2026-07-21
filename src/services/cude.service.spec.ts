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
      horDoc: "17:00:00",
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

    const fecDate = new Date(input.fecDoc);
    const horSource = new Date(`${input.fecDoc}T${input.horDoc}`);
    const fmtDec = (v: string) =>
      parseFloat(v).toFixed(2).replace(".", ",");
    const fmtDate = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const fmtTime = (d: Date) =>
      `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}-05:00`;

    const concatenated = [
      input.numDoc,
      fmtDate(fecDate),
      fmtTime(horSource),
      fmtDec(input.valBruto),
      fmtDec(input.valIva),
      fmtDec(input.valAdicional),
      fmtDec(input.valTotal),
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

    const expectedHash = crypto
      .createHash("sha384")
      .update(concatenated, "utf8")
      .digest("hex")
      .toUpperCase();

    const cude = service.generate(input);
    expect(cude).toBe(expectedHash);
  });
});
