import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { Tenant } from '@/database/entities/tenant.entity';
import { User } from '@/database/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, User])],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
