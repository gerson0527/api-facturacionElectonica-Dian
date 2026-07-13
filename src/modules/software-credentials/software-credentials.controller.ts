import { Controller, Post, Get, Param, Body } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SoftwareCredentialsService } from "./software-credentials.service";
import { IsString, IsOptional } from "class-validator";

export class CreateSoftwareCredentialDto {
  @IsString()
  softwareId: string;

  @IsString()
  softwarePin: string;

  @IsOptional()
  @IsString()
  testSetId?: string;
}

@ApiTags("Software Credentials")
@Controller("tenants/:tenantId/software-credentials")
export class SoftwareCredentialsController {
  constructor(private readonly service: SoftwareCredentialsService) {}

  @Post()
  @ApiOperation({ summary: "Registrar software DIAN" })
  async create(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateSoftwareCredentialDto,
  ) {
    return this.service.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: "Listar credenciales de software" })
  async findAll(@Param("tenantId") tenantId: string) {
    return this.service.findByTenant(tenantId);
  }
}
