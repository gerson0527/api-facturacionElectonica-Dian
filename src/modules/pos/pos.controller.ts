import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PosService } from './pos.service';
import { CreateSaleDto } from './dto/create-sale.dto';

@Controller('pos/sales')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class PosController {
  constructor(private pos: PosService) {}

  @Post()
  @Roles('tenant_cashier', 'tenant_admin', 'tenant_supervisor')
  async create(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() dto: CreateSaleDto) {
    return this.pos.createSale(dto, tenantId, user.sub);
  }

  @Get('by-session/:sessionId')
  list(@TenantId() tenantId: string, @Param('sessionId') sessionId: string) {
    return this.pos.listBySession(tenantId, sessionId);
  }
}
