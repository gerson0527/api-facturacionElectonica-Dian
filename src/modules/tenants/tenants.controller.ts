import { Controller, Post, Get, Param, Body } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { TenantsService } from "./tenants.service";
import { IsString, IsOptional } from "class-validator";

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
}

@ApiTags("Tenants")
@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({ summary: "Crear empresa (genera admin automáticamente)" })
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Consultar empresa" })
  async findById(@Param("id") id: string) {
    return this.tenantsService.findById(id);
  }
}
