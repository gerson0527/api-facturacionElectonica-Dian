import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NumberingRange } from '@/database/entities/numbering-range.entity';
import { NumberingRangesService } from './numbering-ranges.service';

describe('NumberingRangesService', () => {
  let service: NumberingRangesService;

  const rangeRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const queryBuilderSelect = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const queryBuilderUpdate = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };

  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      createQueryBuilder: jest.fn(),
    },
  };

  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NumberingRangesService,
        { provide: getRepositoryToken(NumberingRange), useValue: rangeRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<NumberingRangesService>(NumberingRangesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('create inicializa currentNumber como fromNumber - 1', async () => {
    rangeRepo.create.mockImplementation((payload: Partial<NumberingRange>) => payload);
    rangeRepo.save.mockImplementation(async (payload: Partial<NumberingRange>) => payload);

    const result = await service.create('tenant-1', {
      prefix: 'FE',
      fromNumber: 100,
      toNumber: 200,
      resolutionNumber: 'RES-1',
      resolutionDate: '2026-01-10',
    });

    expect(rangeRepo.create).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      prefix: 'FE',
      fromNumber: 100,
      toNumber: 200,
      currentNumber: 99,
      resolutionNumber: 'RES-1',
      resolutionDate: new Date('2026-01-10'),
      isActive: true,
    });
    expect(result.currentNumber).toBe(99);
  });

  it('findByTenant consulta solo rangos activos del tenant', async () => {
    rangeRepo.find.mockResolvedValue([{ id: 'range-1' }]);

    const result = await service.findByTenant('tenant-1');

    expect(rangeRepo.find).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1', isActive: true } });
    expect(result).toEqual([{ id: 'range-1' }]);
  });

  it('reserveNextNumber reserva consecutivo y actualiza currentNumber', async () => {
    queryRunner.manager.createQueryBuilder
      .mockReturnValueOnce(queryBuilderSelect)
      .mockReturnValueOnce(queryBuilderUpdate);
    queryBuilderSelect.getOne.mockResolvedValue({
      id: 'range-1',
      prefix: 'FE',
      currentNumber: 10,
      toNumber: 50,
      isActive: true,
    });
    queryBuilderUpdate.execute.mockResolvedValue({ affected: 1 });

    const result = await service.reserveNextNumber('tenant-1', 'FE');

    expect(queryRunner.connect).toHaveBeenCalled();
    expect(queryRunner.startTransaction).toHaveBeenCalled();
    expect(queryBuilderSelect.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(queryBuilderUpdate.update).toHaveBeenCalledWith(NumberingRange);
    expect(queryBuilderUpdate.set).toHaveBeenCalledWith({ currentNumber: 11 });
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
    expect(result).toEqual({
      number: 'FE0000000011',
      rangeId: 'range-1',
    });
  });

  it('reserveNextNumber lanza not found cuando no existe rango activo', async () => {
    queryRunner.manager.createQueryBuilder.mockReturnValueOnce(queryBuilderSelect);
    queryBuilderSelect.getOne.mockResolvedValue(null);

    await expect(service.reserveNextNumber('tenant-1', 'FE')).rejects.toThrow(
      new NotFoundException('Rango de numeración con prefijo FE no encontrado'),
    );

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it('reserveNextNumber lanza conflicto si el rango está agotado', async () => {
    queryRunner.manager.createQueryBuilder.mockReturnValueOnce(queryBuilderSelect);
    queryBuilderSelect.getOne.mockResolvedValue({
      id: 'range-1',
      prefix: 'FE',
      currentNumber: 50,
      toNumber: 50,
      isActive: true,
    });

    await expect(service.reserveNextNumber('tenant-1', 'FE')).rejects.toThrow(
      new ConflictException('Rango de numeración agotado para prefijo FE'),
    );

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });
});
