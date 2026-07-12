import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NumberingRangesController } from './numbering-ranges.controller';
import { NumberingRangesService } from './numbering-ranges.service';
import { NumberingRange } from '@/database/entities/numbering-range.entity';
import { Tenant } from '@/database/entities/tenant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NumberingRange, Tenant])],
  controllers: [NumberingRangesController],
  providers: [NumberingRangesService],
  exports: [NumberingRangesService],
})
export class NumberingRangesModule {}
