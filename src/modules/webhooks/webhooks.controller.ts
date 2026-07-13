import { Controller, Post, Get, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { WebhooksService } from "./webhooks.service";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { TenantId } from "@/common/decorators/tenant-id.decorator";
import { CurrentUser, JwtPayload } from "@/common/decorators/current-user.decorator";

@ApiTags("Webhooks")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post("endpoints")
  @Roles("tenant_admin")
  @ApiOperation({ summary: "Create a new webhook endpoint" })
  async createEndpoint(
    @Body() body: { url: string; subscribedEvents: string[] },
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.webhooksService.createEndpoint(tenantId || user.tenant_id, body.url, body.subscribedEvents);
  }

  @Get("endpoints")
  @Roles("tenant_admin")
  @ApiOperation({ summary: "List webhook endpoints" })
  async listEndpoints(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    return this.webhooksService.listEndpoints(tenantId || user.tenant_id);
  }

  @Delete("endpoints/:id")
  @Roles("tenant_admin")
  @ApiOperation({ summary: "Delete webhook endpoint" })
  async deleteEndpoint(
    @Param("id") id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.webhooksService.deleteEndpoint(tenantId || user.tenant_id, id);
    return { success: true };
  }

  @Get("deliveries")
  @Roles("tenant_admin", "tenant_user")
  @ApiOperation({ summary: "List webhook deliveries history" })
  async listDeliveries(@TenantId() tenantId: string, @CurrentUser() user: JwtPayload) {
    return this.webhooksService.getDeliveries(tenantId || user.tenant_id);
  }
}
