import { CufeService } from './cufe.service';

describe('CufeService - Integration', () => {
  let service: CufeService;

  beforeEach(() => {
    service = new CufeService();
  });

  it('debe generar CUFE de 96 caracteres hexadecimales', () => {
    const cufe = service.generate({
      numFac: 'SETP990000000001',
      fecFac: '2024-06-15',
      horFac: '14:30:00',
      valBruto: '2500000.00',
      valIva: '475000.00',
      valAdicional: '0.00',
      valTotal: '2975000.00',
      nitEmisor: '900123456',
      tipoDocEmisor: '31',
      tipoDocAdquirente: '13',
      numDocAdquirente: '123456789',
      softwarePin: 'SE3F5G8H2K7M4N9P',
      ambiente: '1',
    });

    expect(cufe).toMatch(/^[A-F0-9]{96}$/);
    expect(cufe).toBeDefined();
  });

  it('debe generar CUFE diferente para ambiente produccion vs habilitacion', () => {
    const base = {
      numFac: 'SETP990000000001',
      fecFac: '2024-06-15',
      horFac: '14:30:00',
      valBruto: '2500000.00',
      valIva: '475000.00',
      valAdicional: '0.00',
      valTotal: '2975000.00',
      nitEmisor: '900123456',
      tipoDocEmisor: '31',
      tipoDocAdquirente: '13',
      numDocAdquirente: '123456789',
      softwarePin: 'SE3F5G8H2K7M4N9P',
    };

    const cufeHabilitacion = service.generate({ ...base, ambiente: '1' });
    const cufeProduccion = service.generate({ ...base, ambiente: '2' });

    expect(cufeHabilitacion).not.toBe(cufeProduccion);
  });

  it('debe generar CUFE deterministico (mismos input => mismo output)', () => {
    const input = {
      numFac: 'SETP990000000001',
      fecFac: '2024-06-15',
      horFac: '14:30:00',
      valBruto: '2500000.00',
      valIva: '475000.00',
      valAdicional: '0.00',
      valTotal: '2975000.00',
      nitEmisor: '900123456',
      tipoDocEmisor: '31',
      tipoDocAdquirente: '13',
      numDocAdquirente: '123456789',
      softwarePin: 'SE3F5G8H2K7M4N9P',
      ambiente: '1',
    };

    const cufe1 = service.generate(input);
    const cufe2 = service.generate(input);
    expect(cufe1).toBe(cufe2);
  });
});
