import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import {
  formatDecimalCol,
  formatDateCol,
  formatTimeCol,
} from "./dian-format.util";

export interface CufeInput {
  numFac: string;
  fecFac: string;
  horFac: string;
  valBruto: string;
  valIva: string;
  valAdicional: string;
  valTotal: string;
  nitEmisor: string;
  dvEmisor: string;
  tipoDocEmisor: string;
  tipoDocAdquirente: string;
  numDocAdquirente: string;
  dvAdquirente: string;
  softwarePin: string;
  ambiente: string;
}

@Injectable()
export class CufeService {
  generate(input: CufeInput): string {
    const fecDate = new Date(input.fecFac);
    const horSource = input.horFac
      ? new Date(`${input.fecFac}T${input.horFac}`)
      : fecDate;

    const parts = [
      input.numFac,
      formatDateCol(fecDate),
      formatTimeCol(horSource),
      formatDecimalCol(input.valBruto),
      formatDecimalCol(input.valIva),
      formatDecimalCol(input.valAdicional),
      formatDecimalCol(input.valTotal),
      input.nitEmisor,
      input.dvEmisor,
      input.tipoDocEmisor,
      input.tipoDocAdquirente,
      input.numDocAdquirente,
      input.dvAdquirente,
      input.softwarePin,
      input.ambiente,
    ];

    const concatenated = parts.join("");

    return crypto
      .createHash("sha384")
      .update(concatenated, "utf8")
      .digest("hex")
      .toUpperCase();
  }

  generateCude(input: CufeInput): string {
    return this.generate(input);
  }
}