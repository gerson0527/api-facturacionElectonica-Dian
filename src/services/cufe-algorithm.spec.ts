import { CufeService } from './cufe.service';
import { v4 as uuidv4 } from 'uuid';

describe('CUFE Algorithm', () => {
  const cufeService = new CufeService();

  // Based on Anexo Técnico 1.9: SHA-384 concatenation of specific fields
  it('debe implementar el algoritmo según Anexo Técnico 1.9', () => {
    const input = {
      numFac: 'SETP990000000001',
      fecFac: '2024-06-15',
      horFac: '14:30:00',
      valBruto: '1000000.00',
      valIva: '190000.00',
      valAdicional: '0.00',
      valTotal: '1190000.00',
      nitEmisor: '900123456',
      tipoDocEmisor: '31',
      tipoDocAdquirente: '13',
      numDocAdquirente: '123456789',
      softwarePin: 'SE3F5G8H2K7M4N9P',
      ambiente: '1',
    };

    const cufe = cufeService.generate(input);
    expect(cufe.length).toBe(96); // SHA-384 hex = 96 caracteres
    expect(cufe).toMatch(/^[0-9A-F]{96}$/);
  });

  it('debe ser sensible al numero de factura', () => {
    const base = {
      fecFac: '2024-06-15',
      horFac: '14:30:00',
      valBruto: '1000000.00',
      valIva: '190000.00',
      valAdicional: '0.00',
      valTotal: '1190000.00',
      nitEmisor: '900123456',
      tipoDocEmisor: '31',
      tipoDocAdquirente: '13',
      numDocAdquirente: '123456789',
      softwarePin: 'SE3F5G8H2K7M4N9P',
      ambiente: '1',
    };
    const cufe1 = cufeService.generate({ ...base, numFac: 'SETP1' });
    const cufe2 = cufeService.generate({ ...base, numFac: 'SETP2' });
    expect(cufe1).not.toBe(cufe2);
  });

  it('debe ser sensible al NIT del emisor', () => {
    const base = {
      numFac: 'SETP990000000001',
      fecFac: '2024-06-15',
      horFac: '14:30:00',
      valBruto: '1000000.00',
      valIva: '190000.00',
      valAdicional: '0.00',
      valTotal: '1190000.00',
      tipoDocEmisor: '31',
      tipoDocAdquirente: '13',
      numDocAdquirente: '123456789',
      softwarePin: 'SE3F5G8H2K7M4N9P',
      ambiente: '1',
    };
    const cufe1 = cufeService.generate({ ...base, nitEmisor: '900123456' });
    const cufe2 = cufeService.generate({ ...base, nitEmisor: '800123456' });
    expect(cufe1).not.toBe(cufe2);
  });

  it('debe ser sensible al software pin', () => {
    const base = {
      numFac: 'SETP990000000001',
      fecFac: '2024-06-15',
      horFac: '14:30:00',
      valBruto: '1000000.00',
      valIva: '190000.00',
      valAdicional: '0.00',
      valTotal: '1190000.00',
      nitEmisor: '900123456',
      tipoDocEmisor: '31',
      tipoDocAdquirente: '13',
      numDocAdquirente: '123456789',
      ambiente: '1',
    };
    const cufe1 = cufeService.generate({ ...base, softwarePin: 'PIN-A' });
    const cufe2 = cufeService.generate({ ...base, softwarePin: 'PIN-B' });
    expect(cufe1).not.toBe(cufe2);
  });

  it('debe ser sensible al total', () => {
    const base = {
      numFac: 'SETP990000000001',
      fecFac: '2024-06-15',
      horFac: '14:30:00',
      valBruto: '1000000.00',
      valIva: '190000.00',
      valAdicional: '0.00',
      nitEmisor: '900123456',
      tipoDocEmisor: '31',
      tipoDocAdquirente: '13',
      numDocAdquirente: '123456789',
      softwarePin: 'SE3F5G8H2K7M4N9P',
      ambiente: '1',
    };
    const cufe1 = cufeService.generate({ ...base, valTotal: '1190000.00' });
    const cufe2 = cufeService.generate({ ...base, valTotal: '1195000.00' });
    expect(cufe1).not.toBe(cufe2);
  });
});
