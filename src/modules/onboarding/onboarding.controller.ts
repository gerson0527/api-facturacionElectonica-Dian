import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { OnboardingService } from "./onboarding.service";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { TenantId } from "@/common/decorators/tenant-id.decorator";
import { CurrentUser, JwtPayload } from "@/common/decorators/current-user.decorator";
import { IsString } from "class-validator";

export class TriggerTestSetDto {
  @IsString()
  testSetId: string;
}

@ApiTags("Onboarding (Set de Pruebas)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post("test-set")
  @Roles("tenant_admin")
  @ApiOperation({ summary: "Disparar el Set de Pruebas DIAN para habilitación" })
  async triggerTestSet(
    @Body() dto: TriggerTestSetDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.onboardingService.triggerTestSet(tenantId || user.tenant_id, dto.testSetId, user.sub);
  }
}
