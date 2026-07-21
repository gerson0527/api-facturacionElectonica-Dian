import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CashService } from './cash.service';

@Controller('cash-registers')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class CashRegistersController {
  constructor(private cash: CashService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.cash.listRegisters(tenantId);
  }

  @Post()
  @Roles('tenant_admin', 'tenant_supervisor')
  create(@TenantId() tenantId: string, @Body() data: any) {
    return this.cash.createRegister(tenantId, data);
  }
}