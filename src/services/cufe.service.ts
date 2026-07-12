import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface CufeInput {
  numFac: string;
  fecFac: string;
  horFac: string;
  valBruto: string;
  valIva: string;
  valAdicional: string;
  valTotal: string;
  nitEmisor: string;
  tipoDocEmisor: string;
  tipoDocAdquirente: string;
  numDocAdquirente: string;
  softwarePin: string;
  ambiente: string;
}

@Injectable()
export class CufeService {
  generate(input: CufeInput): string {
    const concatenated = [
      input.numFac,
      input.fecFac,
      input.horFac,
      input.valBruto,
      input.valIva,
      input.valAdicional,
      input.valTotal,
      input.nitEmisor,
      input.tipoDocEmisor,
      input.tipoDocAdquirente,
      input.numDocAdquirente,
      input.softwarePin,
      input.ambiente,
    ].join('');

    return crypto.createHash('sha384').update(concatenated, 'utf8').digest('hex').toUpperCase();
  }
}
