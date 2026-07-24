import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { NumberingRange } from "@/database/entities/numbering-range.entity";

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

  async reserveNextNumber(
    tenantId: string,
    prefix: string,
    manager?: import("typeorm").EntityManager,
  ): Promise<{ number: string; rangeId: string }> {
    if (manager) {
      return this._reserveInternal(manager, tenantId, prefix);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await this._reserveInternal(queryRunner.manager, tenantId, prefix);
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async _reserveInternal(
    manager: import("typeorm").EntityManager,
    tenantId: string,
    prefix: string,
  ): Promise<{ number: string; rangeId: string }> {
    let range = await manager
      .createQueryBuilder(NumberingRange, "nr")
      .setLock("pessimistic_write")
      .where("nr.tenantId = :tenantId", { tenantId })
      .andWhere("nr.prefix = :prefix", { prefix })
      .andWhere("nr.isActive = :isActive", { isActive: true })
      .getOne();

    if (!range) {
      const newRange = manager.create(NumberingRange, {
        tenantId,
        prefix,
        fromNumber: 1,
        toNumber: 99999999,
        currentNumber: 0,
        resolutionNumber: 'SYSTEM-DEFAULT',
        resolutionDate: new Date(),
        isActive: true,
      });
      range = await manager.save(newRange);
    }

    if (range.validTo && new Date() > new Date(range.validTo)) {
      throw new ConflictException(
        `Resolution ${range.id} expired on ${range.validTo}`,
      );
    }
    if (range.validFrom && new Date() < new Date(range.validFrom)) {
      throw new ConflictException(
        `Resolution ${range.id} not yet valid (starts ${range.validFrom})`,
      );
    }

    const nextNumber = range.currentNumber + 1;
    if (nextNumber > range.toNumber) {
      throw new ConflictException(
        `Rango de numeración agotado para prefijo ${prefix}`,
      );
    }

    await manager
      .createQueryBuilder()
      .update(NumberingRange)
      .set({ currentNumber: nextNumber })
      .where("id = :id", { id: range.id })
      .execute();

    const formattedNumber = `${range.prefix}${String(nextNumber).padStart(10, "0")}`;
    return { number: formattedNumber, rangeId: range.id };
  }
}
