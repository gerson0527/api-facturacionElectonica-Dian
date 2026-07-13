import { Controller, Post, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RadianService } from "./radian.service";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { TenantId } from "@/common/decorators/tenant-id.decorator";
import { CurrentUser, JwtPayload } from "@/common/decorators/current-user.decorator";

@ApiTags("RADIAN Events")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("invoices/:invoiceId/events")
export class RadianController {
  constructor(private readonly radianService: RadianService) {}

  @Post("acuse-recibo")
  @Roles("tenant_admin", "user")
  @ApiOperation({ summary: "Emitir Acuse de Recibo (030)" })
  async acuseRecibo(
    @Param("invoiceId") invoiceId: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.radianService.emitEvent(
      tenantId || user.tenant_id,
      invoiceId,
      "030",
      "Acuse de recibo de Factura Electrónica de Venta",
      user.sub
    );
  }

  @Post("recibo-bien")
  @Roles("tenant_admin", "user")
  @ApiOperation({ summary: "Emitir Recibo del Bien o Prestación del Servicio (032)" })
  async reciboBien(
    @Param("invoiceId") invoiceId: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.radianService.emitEvent(
      tenantId || user.tenant_id,
      invoiceId,
      "032",
      "Recibo del bien y/o prestación del servicio",
      user.sub
    );
  }

  @Post("aceptacion-expresa")
  @Roles("tenant_admin", "user")
  @ApiOperation({ summary: "Emitir Aceptación Expresa (033)" })
  async aceptacionExpresa(
    @Param("invoiceId") invoiceId: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.radianService.emitEvent(
      tenantId || user.tenant_id,
      invoiceId,
      "033",
      "Aceptación expresa de la Factura Electrónica de Venta",
      user.sub
    );
  }

  @Post("reclamo")
  @Roles("tenant_admin", "user")
  @ApiOperation({ summary: "Emitir Reclamo / Rechazo (031)" })
  async reclamo(
    @Param("invoiceId") invoiceId: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.radianService.emitEvent(
      tenantId || user.tenant_id,
      invoiceId,
      "031",
      "Reclamo de la Factura Electrónica de Venta",
      user.sub
    );
  }
}
