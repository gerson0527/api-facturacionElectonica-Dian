import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, Invoice } from '@/database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Invoice])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService]
})
export class PaymentsModule {}
