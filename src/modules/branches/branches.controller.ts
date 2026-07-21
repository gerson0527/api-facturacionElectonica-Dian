import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { TenantId } from "../../common/decorators/tenant-id.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { BranchesService } from "./branches.service";

@Controller("branches")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class BranchesController {
  constructor(private svc: BranchesService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.svc.listBranches(tenantId);
  }

  @Post()
  @Roles("tenant_admin", "tenant_supervisor")
  create(@TenantId() tenantId: string, @Body() data: any) {
    return this.svc.createBranch(tenantId, data);
  }

  @Get(":id/warehouses")
  warehouses(@TenantId() tenantId: string, @Param("id") branchId: string) {
    return this.svc.listWarehouses(tenantId, branchId);
  }

  @Post(":id/warehouses")
  @Roles("tenant_admin", "tenant_supervisor")
  createWarehouse(
    @TenantId() tenantId: string,
    @Param("id") branchId: string,
    @Body() data: any,
  ) {
    return this.svc.createWarehouse(tenantId, { ...data, branchId });
  }
}
