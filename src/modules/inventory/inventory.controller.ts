import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';

@Controller('inventory')
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
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('movements')
  findAll(@TenantId() tenantId: string) {
    return this.inventoryService.findAll(tenantId);
  }

  @Post('movements')
  @Roles('tenant_admin', 'tenant_supervisor', 'tenant_cashier')
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateInventoryMovementDto,
  ) {
    return this.inventoryService.createMovement(tenantId, dto);
  }
}