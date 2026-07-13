import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { AuditService } from "@/services/audit.service";
import { TenantId } from "@/common/decorators/tenant-id.decorator";
import { IsOptional, IsString, IsNumber } from "class-validator";

export class AuditQueryDto {
  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsNumber()
  offset?: number;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  actor?: string;
}

@ApiTags("Audit")
@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: "Consultar eventos de auditoría" })
  async findAll(@TenantId() tenantId: string, @Query() query: AuditQueryDto) {
    return this.auditService.findByTenant(tenantId, query);
  }
}
