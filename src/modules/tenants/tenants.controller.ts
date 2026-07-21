import { Controller, Post, Get, Param, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { TenantsService } from "./tenants.service";
import { IsString, IsOptional } from "class-validator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { TenantId } from "@/common/decorators/tenant-id.decorator";
import { CurrentUser, JwtPayload } from "@/common/decorators";

export class CreateTenantDto {
  @IsString()
  name: string;

  @IsString()
  nit: string;

  @IsOptional()
  @IsString()
  dv?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsString()
  adminEmail: string;

  @IsString()
  adminPassword: string;
}

@ApiTags("Tenants")
@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin")
  @ApiOperation({ summary: "Crear empresa (genera admin automáticamente)" })
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("super_admin")
  @ApiOperation({ summary: "Listar todas las empresas (solo super_admin)" })
  async findAll() {
    return this.tenantsService.findAll();
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({ summary: "Consultar empresa" })
  async findById(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ) {
    if (user.role !== "super_admin" && user.tenant_id !== id) {
      return null;
    }
    return this.tenantsService.findById(id);
  }
}