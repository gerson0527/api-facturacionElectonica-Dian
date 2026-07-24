import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CashService } from './cash.service';

@Controller('cash-registers')
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
export class CashRegistersController {
  constructor(private cash: CashService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.cash.listRegisters(tenantId);
  }

  @Post()
  @Roles('tenant_admin', 'tenant_supervisor', 'tenant_cashier', 'tenant_user')
  create(@TenantId() tenantId: string, @Body() data: any) {
    return this.cash.createRegister(tenantId, data);
  }

  @Delete(':id')
  @Roles('tenant_admin', 'tenant_supervisor', 'tenant_cashier', 'tenant_user')
  delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.cash.deleteRegister(tenantId, id);
  }
}