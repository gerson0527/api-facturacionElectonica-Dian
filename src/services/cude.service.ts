import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface CudeInput {
  numDoc: string;
  fecDoc: string;
  horDoc: string;
  valBruto: string;
  valIva: string;
  valAdicional: string;
  valTotal: string;
  nitEmisor: string;
  dvEmisor: string;
  tipoDocAdquirente: string;
  numDocAdquirente: string;
  dvAdquirente: string;
  softwarePin: string;
  ambiente: string;
  docOrigenCufe: string;
  motivo: string;
}

@Injectable()
export class CudeService {
  generate(input: CudeInput): string {
    const fields = [
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
    ];

    const concatenated = fields.join('');
    const hash = crypto.createHash('sha384').update(concatenated, 'utf8').digest('hex');
    return hash.toUpperCase();
  }
}
