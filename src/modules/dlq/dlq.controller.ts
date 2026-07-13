import { Controller, Post, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { DlqService } from "./dlq.service";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { TenantId } from "@/common/decorators/tenant-id.decorator";
import { CurrentUser, JwtPayload } from "@/common/decorators/current-user.decorator";

@ApiTags("DLQ (Contingencia)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("dlq")
export class DlqController {
  constructor(private readonly dlqService: DlqService) {}

  @Get()
  @Roles("tenant_admin")
  @ApiOperation({ summary: "Listar facturas en Dead-Letter Queue (DLQ)" })
  async listDlq(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    return this.dlqService.getPendingDlq(tenantId || user.tenant_id);
  }

  @Post(":id/retry")
  @Roles("tenant_admin")
  @ApiOperation({ summary: "Re-encolar una factura específica del DLQ" })
  async retryItem(
    @Param("id") id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.dlqService.retryDlqItem(tenantId || user.tenant_id, id);
    return { success: true, message: "Factura re-encolada para transmisión a la DIAN" };
  }

  @Post("retry-all")
  @Roles("tenant_admin")
  @ApiOperation({ summary: "Re-encolar todas las facturas del DLQ (Restablecimiento masivo)" })
  async retryAll(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    return this.dlqService.retryAllDlq(tenantId || user.tenant_id);
  }
}
