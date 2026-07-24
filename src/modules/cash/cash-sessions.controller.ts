import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CashService } from './cash.service';

@Controller('cash-sessions')
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
export class CashSessionsController {
  constructor(private cash: CashService) {}

  @Get()
  list(@TenantId() tenantId: string, @Query('status') status?: string) {
    return this.cash.listSessions(tenantId, status);
  }

  @Get('current')
  async current(@TenantId() tenantId: string, @CurrentUser() user: any) {
    return this.cash.getOpenSession(user.sub, tenantId);
  }

  @Get(':id/movements')
  movements(@TenantId() tenantId: string, @Param('id') sessionId: string) {
    return this.cash.listMovements(tenantId, sessionId);
  }

  @Post()
  @Roles('tenant_cashier', 'tenant_admin', 'tenant_supervisor')
  open(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { cashRegisterId: string; openingAmount: number; branchId: string },
  ) {
    return this.cash.openSession(tenantId, user.sub, body.cashRegisterId, body.openingAmount, body.branchId);
  }

  @Post(':id/close')
  @Roles('tenant_cashier', 'tenant_admin', 'tenant_supervisor')
  close(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') sessionId: string,
    @Body() body: { closingAmount: number; notes?: string },
  ) {
    return this.cash.closeSession(tenantId, sessionId, user.sub, body.closingAmount, body.notes);
  }
}