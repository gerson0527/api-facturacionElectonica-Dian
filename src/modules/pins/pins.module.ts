import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserPin } from '../../database/entities/user-pin.entity';
import { PinsService } from './pins.service';
import { PinsController } from './pins.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserPin])],
  providers: [PinsService],
  controllers: [PinsController],
  exports: [PinsService],
})
export class PinsModule {}
