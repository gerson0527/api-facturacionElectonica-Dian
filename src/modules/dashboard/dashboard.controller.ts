import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles('tenant_admin', 'tenant_user', 'tenant_viewer')
  @ApiOperation({ summary: 'Obtener estadísticas reales para el dashboard' })
  async getStats(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const resolvedTenantId = tenantId || user.tenant_id;
    return this.dashboardService.getDashboardStats(resolvedTenantId);
  }
}
