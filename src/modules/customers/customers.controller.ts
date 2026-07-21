import { Controller, Post, Get, Param, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { CustomersService } from "./customers.service";
import { IsString, IsOptional, IsArray } from "class-validator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { TenantId } from "@/common/decorators/tenant-id.decorator";

export class CreateCustomerDto {
  @IsString()
  documentType: string;

  @IsString()
  documentNumber: string;

  @IsOptional()
  @IsString()
  dv?: string;

  @IsString()
  name: string;

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
  municipalityCode?: string;

  @IsOptional()
  @IsArray()
  fiscalResponsibilities?: string[];
}

@ApiTags("Customers")
@Controller("customers")
@UseGuards(JwtAuthGuard, TenantGuard)
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Post()
  @ApiOperation({ summary: "Crear cliente" })
  async create(
    @TenantId() tenantId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.service.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: "Listar clientes" })
  async findAll(@TenantId() tenantId: string) {
    return this.service.findByTenant(tenantId);
  }

  @Get(":customerId")
  @ApiOperation({ summary: "Consultar cliente" })
  async findOne(
    @TenantId() tenantId: string,
    @Param("customerId") customerId: string,
  ) {
    return this.service.findOne(customerId, tenantId);
  }
}