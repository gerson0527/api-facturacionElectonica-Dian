import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditController } from './audit.controller';
import { AuditEvent } from '@/database/entities/audit-event.entity';
import { AuditService } from '@/services/audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
