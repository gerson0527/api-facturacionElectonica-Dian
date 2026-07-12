import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NumberingRange } from '@/database/entities/numbering-range.entity';

@Injectable()
export class NumberingRangesService {
  private readonly logger = new Logger(NumberingRangesService.name);

  constructor(
    @InjectRepository(NumberingRange)
    private readonly rangeRepo: Repository<NumberingRange>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    tenantId: string,
    data: {
      prefix: string;
      fromNumber: number;
      toNumber: number;
      resolutionNumber: string;
      resolutionDate: string;
    },
  ): Promise<NumberingRange> {
    const range = this.rangeRepo.create({
      tenantId,
      prefix: data.prefix,
      fromNumber: data.fromNumber,
      toNumber: data.toNumber,
      currentNumber: data.fromNumber - 1,
      resolutionNumber: data.resolutionNumber,
      resolutionDate: new Date(data.resolutionDate),
      isActive: true,
    });
    return this.rangeRepo.save(range);
  }

  async findByTenant(tenantId: string): Promise<NumberingRange[]> {
    return this.rangeRepo.find({ where: { tenantId, isActive: true } });
  }

  async reserveNextNumber(tenantId: string, prefix: string): Promise<{ number: string; rangeId: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const range = await queryRunner.manager
        .createQueryBuilder(NumberingRange, 'nr')
        .setLock('pessimistic_write')
        .where('nr.tenantId = :tenantId', { tenantId })
        .andWhere('nr.prefix = :prefix', { prefix })
        .andWhere('nr.isActive = :isActive', { isActive: true })
        .getOne();

      if (!range) {
        throw new NotFoundException(`Rango de numeración con prefijo ${prefix} no encontrado`);
      }

      const nextNumber = range.currentNumber + 1;
      if (nextNumber > range.toNumber) {
        throw new ConflictException(`Rango de numeración agotado para prefijo ${prefix}`);
      }

      await queryRunner.manager
        .createQueryBuilder()
        .update(NumberingRange)
        .set({ currentNumber: nextNumber })
        .where('id = :id', { id: range.id })
        .execute();

      await queryRunner.commitTransaction();

      const formattedNumber = `${range.prefix}${String(nextNumber).padStart(10, '0')}`;
      return { number: formattedNumber, rangeId: range.id };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
