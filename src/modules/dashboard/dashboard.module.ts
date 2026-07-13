import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Invoice } from '@/database/entities/invoice.entity';
import { Customer } from '@/database/entities/customer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, Customer])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
