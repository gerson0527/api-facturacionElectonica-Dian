import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DianSoftwareCredential } from '@/database/entities/dian-software-credential.entity';
import { Tenant } from '@/database/entities/tenant.entity';
import { CryptoService } from '@/services/crypto.service';
import { SoftwareCredentialsService } from './software-credentials.service';

describe('SoftwareCredentialsService', () => {
  let service: SoftwareCredentialsService;

  const credRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const tenantRepo = {
    findOne: jest.fn(),
  };

  const cryptoService = {
    encrypt: jest.fn(),
    encryptWithIntegrity: jest.fn(),
    decrypt: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SoftwareCredentialsService,
        { provide: getRepositoryToken(DianSoftwareCredential), useValue: credRepo },
        { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
        { provide: CryptoService, useValue: cryptoService },
      ],
    }).compile();

    service = module.get<SoftwareCredentialsService>(SoftwareCredentialsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('create lanza not found cuando el tenant no existe', async () => {
    tenantRepo.findOne.mockResolvedValue(null);

    await expect(
      service.create('tenant-1', { softwareId: 'sw-1', softwarePin: '12345' }),
    ).rejects.toThrow(new NotFoundException('Tenant no encontrado'));
  });

  it('create cifra el pin y guarda la credencial', async () => {
    tenantRepo.findOne.mockResolvedValue({ id: 'tenant-1' });
    cryptoService.encryptWithIntegrity.mockReturnValue({
      ciphertext: 'enc',
      iv: 'iv',
      authTag: 'tag',
      keyVersion: 1,
      integrityHash: 'abc',
    });
    credRepo.create.mockImplementation((payload: Partial<DianSoftwareCredential>) => payload);
    credRepo.save.mockImplementation(async (payload: Partial<DianSoftwareCredential>) => payload);

    const result = await service.create('tenant-1', {
      softwareId: 'sw-1',
      softwarePin: '12345',
      testSetId: 'ts-1',
    });

    expect(cryptoService.encryptWithIntegrity).toHaveBeenCalledWith('12345', 'software-pin:tenant-1:sw-1');
    expect(credRepo.create).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      softwareId: 'sw-1',
      softwarePinEncrypted: JSON.stringify({
        ciphertext: 'enc',
        iv: 'iv',
        authTag: 'tag',
        keyVersion: 1,
        integrityHash: 'abc',
      }),
      testSetId: 'ts-1',
      habilitacionStatus: 'pending',
    });
    expect(result.softwareId).toBe('sw-1');
  });

  it('findOne lanza not found cuando no existe la credencial', async () => {
    credRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne('cred-1', 'tenant-1')).rejects.toThrow(
      new NotFoundException('Credencial no encontrada'),
    );
  });

  it('decryptPin retorna el pin descifrado', async () => {
    cryptoService.decrypt.mockReturnValue('12345');

    const pin = await service.decryptPin({
      tenantId: 'tenant-1',
      softwareId: 'sw-1',
      softwarePinEncrypted: JSON.stringify({
        ciphertext: 'enc',
        iv: 'iv',
        authTag: 'tag',
        keyVersion: 1,
      }),
    } as DianSoftwareCredential);

    expect(cryptoService.decrypt).toHaveBeenCalledWith(
      { ciphertext: 'enc', iv: 'iv', authTag: 'tag', keyVersion: 1 },
      'software-pin:tenant-1:sw-1',
    );
    expect(pin).toBe('12345');
  });
});
