import { Test, TestingModule } from '@nestjs/testing';
import { CufeService } from './cufe.service';

describe('CufeService', () => {
  let service: CufeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CufeService],
    }).compile();

    service = module.get<CufeService>(CufeService);
  });

  it('should generate valid SHA-384 CUFE', () => {
    const input = {
      numFac: 'SETP0000000001',
      fecFac: '2024-01-15',
      horFac: '10:30:00',
      valBruto: '1000000.00',
      valIva: '190000.00',
      valAdicional: '0.00',
      valTotal: '1190000.00',
      nitEmisor: '900123456',
      tipoDocEmisor: '31',
      tipoDocAdquirente: '13',
      numDocAdquirente: '123456789',
      softwarePin: 'test-pin-123',
      ambiente: '1',
    };

    const cufe = service.generate(input);
    expect(cufe).toBeDefined();
    expect(cufe.length).toBe(96); // SHA-384 hex = 96 chars
    expect(cufe).toMatch(/^[A-F0-9]{96}$/);
  });

  it('should generate different CUFE for different inputs', () => {
    const baseInput = {
      numFac: 'SETP0000000001',
      fecFac: '2024-01-15',
      horFac: '10:30:00',
      valBruto: '1000000.00',
      valIva: '190000.00',
      valAdicional: '0.00',
      valTotal: '1190000.00',
      nitEmisor: '900123456',
      tipoDocEmisor: '31',
      tipoDocAdquirente: '13',
      numDocAdquirente: '123456789',
      softwarePin: 'test-pin-123',
      ambiente: '1',
    };

    const cufe1 = service.generate(baseInput);
    const cufe2 = service.generate({ ...baseInput, valTotal: '1200000.00' });
    expect(cufe1).not.toBe(cufe2);
  });
});
