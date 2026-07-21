import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../../database/entities/invoice.entity';
import { InvoiceLine } from '../../database/entities/invoice-line.entity';
import { TaxTotal } from '../../database/entities/tax-total.entity';
import { Product } from '../../database/entities/product.entity';
import { InventoryMovement } from '../../database/entities/inventory-movement.entity';
import { NumberingRange } from '../../database/entities/numbering-range.entity';
import { CashModule } from '../cash/cash.module';
import { PosService } from './pos.service';
import { PosController } from './pos.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceLine, TaxTotal, Product, InventoryMovement, NumberingRange]),
    CashModule,
  ],
  providers: [PosService],
  controllers: [PosController],
  exports: [PosService],
})
export class PosModule {}
