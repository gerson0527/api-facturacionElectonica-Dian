import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { Quotation } from '@/database/entities/quotation.entity';
import { QuotationLine } from '@/database/entities/quotation-line.entity';
import { Customer } from '@/database/entities/customer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Quotation, QuotationLine, Customer])],
  controllers: [QuotationsController],
  providers: [QuotationsService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
