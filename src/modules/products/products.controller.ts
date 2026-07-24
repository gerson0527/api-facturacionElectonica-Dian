import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { TenantId } from '@/common/decorators/tenant-id.decorator';

@Controller('products')
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
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.productsService.findAll(tenantId);
  }

  @Post()
  @Roles('tenant_admin', 'tenant_supervisor')
  create(@TenantId() tenantId: string, @Body() data: any) {
    return this.productsService.create(tenantId, data);
  }
}