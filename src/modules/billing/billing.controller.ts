import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { TenantId } from "../../common/decorators/tenant-id.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { BillingService } from "./billing.service";

@Controller("billing")
export class BillingController {
  constructor(private billing: BillingService) {}

  @Get("plans")
  async listPlans() {
    return this.billing.listPlans();
  }

  @Get("subscription")
  @UseGuards(JwtAuthGuard, TenantGuard)
  async current(@TenantId() tenantId: string) {
    return this.billing.getSubscription(tenantId);
  }

  @Post("subscription/start-trial")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles("tenant_admin")
  async startTrial(@TenantId() tenantId: string) {
    return this.billing.createTrialSubscription(tenantId);
  }

  @Post("subscription/change-plan")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles("tenant_admin")
  async changePlan(
    @TenantId() tenantId: string,
    @Body() body: { planCode: string },
  ) {
    return this.billing.changePlan(tenantId, body.planCode);
  }

  @Post("subscription/cancel")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles("tenant_admin")
  async cancel(@TenantId() tenantId: string) {
    return this.billing.cancel(tenantId);
  }

  @Post("checkout")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles("tenant_admin")
  async checkout(
    @TenantId() tenantId: string,
    @Body() body: { planCode: string; period: "monthly" | "yearly" },
  ) {
    return this.billing.createPreference(tenantId, body.planCode, body.period);
  }
}
