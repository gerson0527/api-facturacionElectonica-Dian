import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DigitalCertificate } from '@/database/entities/digital-certificate.entity';
import { Tenant } from '@/database/entities/tenant.entity';
import { CryptoService } from '@/services/crypto.service';
import { CertificatesService } from './certificates.service';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'uuid-fixed'),
}));

describe('CertificatesService', () => {
  let service: CertificatesService;

  const certRepo = {
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
    decrypt: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string) => (key === 'STORAGE_PATH' ? './storage-test' : undefined)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificatesService,
        { provide: getRepositoryToken(DigitalCertificate), useValue: certRepo },
        { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
        { provide: CryptoService, useValue: cryptoService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<CertificatesService>(CertificatesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('upload lanza not found cuando el tenant no existe', async () => {
    tenantRepo.findOne.mockResolvedValue(null);

    await expect(
      service.upload('tenant-1', 'cert-1', Buffer.from('pfx'), 'pass'),
    ).rejects.toThrow(new NotFoundException('Tenant no encontrado'));
  });

  it('upload guarda archivo cifrado y persiste certificado', async () => {
    tenantRepo.findOne.mockResolvedValue({ id: 'tenant-1' });
    cryptoService.encrypt
      .mockReturnValueOnce({ ciphertext: 'pfx-enc', iv: 'iv1', authTag: 'tag1' })
      .mockReturnValueOnce({ ciphertext: 'pass-enc', iv: 'iv2', authTag: 'tag2' })
      .mockReturnValueOnce({ ciphertext: 'pin-enc', iv: 'iv3', authTag: 'tag3' });

    certRepo.create.mockImplementation((payload: Partial<DigitalCertificate>) => payload);
    certRepo.save.mockImplementation(async (payload: Partial<DigitalCertificate>) => payload);

    const result = await service.upload(
      'tenant-1',
      'Certificado Principal',
      Buffer.from('contenido-pfx'),
      'clave-pfx',
      '1234',
    );

    const certDir = path.join('./storage-test', 'certificates', 'tenant-1');
    const expectedPfxPath = path.join(certDir, 'uuid-fixed.enc');

    expect(uuidv4).toHaveBeenCalled();
    expect(fs.mkdir).toHaveBeenCalledWith(certDir, { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledWith(
      expectedPfxPath,
      JSON.stringify({ ciphertext: 'pfx-enc', iv: 'iv1', authTag: 'tag1' }),
    );

    expect(certRepo.create).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      alias: 'Certificado Principal',
      encryptedPfxPath: expectedPfxPath,
      encryptedPasswordRef: JSON.stringify({ ciphertext: 'pass-enc', iv: 'iv2', authTag: 'tag2' }),
      encryptedPinRef: JSON.stringify({ ciphertext: 'pin-enc', iv: 'iv3', authTag: 'tag3' }),
      isActive: true,
    });
    expect(result.alias).toBe('Certificado Principal');
  });

  it('getDecryptedPfx lanza not found cuando no existe certificado activo', async () => {
    certRepo.findOne.mockResolvedValue(null);

    await expect(service.getDecryptedPfx('cert-1', 'tenant-1')).rejects.toThrow(
      new NotFoundException('Certificado no encontrado'),
    );
  });

  it('getDecryptedPfx descifra pfx, contraseña y pin', async () => {
    certRepo.findOne.mockResolvedValue({
      id: 'cert-1',
      tenantId: 'tenant-1',
      encryptedPfxPath: 'c:\\tmp\\cert.enc',
      encryptedPasswordRef: JSON.stringify({ ciphertext: 'pass-enc', iv: 'iv2', authTag: 'tag2' }),
      encryptedPinRef: JSON.stringify({ ciphertext: 'pin-enc', iv: 'iv3', authTag: 'tag3' }),
      isActive: true,
    });

    (fs.readFile as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ ciphertext: 'pfx-enc', iv: 'iv1', authTag: 'tag1' }),
    );
    cryptoService.decrypt
      .mockReturnValueOnce(Buffer.from('contenido-pfx').toString('base64'))
      .mockReturnValueOnce('clave-pfx')
      .mockReturnValueOnce('1234');

    const result = await service.getDecryptedPfx('cert-1', 'tenant-1');

    expect(fs.readFile).toHaveBeenCalledWith('c:\\tmp\\cert.enc', 'utf-8');
    expect(cryptoService.decrypt).toHaveBeenNthCalledWith(1, 'pfx-enc', 'iv1', 'tag1');
    expect(cryptoService.decrypt).toHaveBeenNthCalledWith(2, 'pass-enc', 'iv2', 'tag2');
    expect(cryptoService.decrypt).toHaveBeenNthCalledWith(3, 'pin-enc', 'iv3', 'tag3');
    expect(result.password).toBe('clave-pfx');
    expect(result.pin).toBe('1234');
    expect(result.pfxBuffer.toString('utf-8')).toBe('contenido-pfx');
  });
});
