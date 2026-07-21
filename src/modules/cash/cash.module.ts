import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashRegister } from '../../database/entities/cash-register.entity';
import { CashSession } from '../../database/entities/cash-session.entity';
import { CashMovement } from '../../database/entities/cash-movement.entity';
import { CashRegistersController } from './cash-registers.controller';
import { CashSessionsController } from './cash-sessions.controller';
import { CashService } from './cash.service';

@Module({
  imports: [TypeOrmModule.forFeature([CashRegister, CashSession, CashMovement])],
  controllers: [CashRegistersController, CashSessionsController],
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}