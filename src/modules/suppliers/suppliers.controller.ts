import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SuppliersService } from './suppliers.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { TenantId } from '@/common/decorators/tenant-id.decorator';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@SkipThrottle({
  default: true,
  short: true,
  login: true,
  refresh: true,
  certificados: true,
  retry: true,
  descargas: true,
  auditoria: true,
  facturas: true,
})
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.suppliersService.findAll(tenantId);
  }

  @Post()
  @Roles('tenant_admin', 'tenant_supervisor')
  create(@TenantId() tenantId: string, @Body() data: any) {
    return this.suppliersService.create(tenantId, data);
  }
}