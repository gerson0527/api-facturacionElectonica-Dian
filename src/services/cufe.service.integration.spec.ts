import { CufeService } from './cufe.service';

describe('CufeService - Integration', () => {
  let service: CufeService;

  const base = {
    numFac: 'SETP990000000001',
    fecFac: '2024-06-15',
    horFac: '14:30:00',
    valBruto: '2500000.00',
    valIva: '475000.00',
    valAdicional: '0.00',
    valTotal: '2975000.00',
    nitEmisor: '900123456',
    dvEmisor: '0',
    tipoDocEmisor: '31',
    tipoDocAdquirente: '13',
    numDocAdquirente: '123456789',
    dvAdquirente: '',
    softwarePin: 'SE3F5G8H2K7M4N9P',
    ambiente: '1',
  };

  beforeEach(() => {
    service = new CufeService();
  });

  it('debe generar CUFE de 96 caracteres hexadecimales', () => {
    const cufe = service.generate(base);
    expect(cufe).toMatch(/^[A-F0-9]{96}$/);
  });

  it('debe generar CUFE diferente para ambiente produccion vs habilitacion', () => {
    const cufeHabilitacion = service.generate({ ...base, ambiente: '1' });
    const cufeProduccion = service.generate({ ...base, ambiente: '2' });
    expect(cufeHabilitacion).not.toBe(cufeProduccion);
  });

  it('debe generar CUFE deterministico', () => {
    const cufe1 = service.generate(base);
    const cufe2 = service.generate(base);
    expect(cufe1).toBe(cufe2);
  });

  it('debe ser sensible al DV del emisor', () => {
    const cufe1 = service.generate(base);
    const cufe2 = service.generate({ ...base, dvEmisor: '5' });
    expect(cufe1).not.toBe(cufe2);
  });

  it('debe ser sensible al DV del adquirente', () => {
    const cufe1 = service.generate(base);
    const cufe2 = service.generate({ ...base, dvAdquirente: '1' });
    expect(cufe1).not.toBe(cufe2);
  });
});
