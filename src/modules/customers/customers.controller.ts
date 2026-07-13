import { Controller, Post, Get, Param, Body, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { CustomersService } from "./customers.service";
import { IsString, IsOptional, IsArray } from "class-validator";

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
@Controller("tenants/:tenantId/customers")
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Post()
  @ApiOperation({ summary: "Crear cliente" })
  async create(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.service.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: "Listar clientes" })
  async findAll(@Param("tenantId") tenantId: string) {
    return this.service.findByTenant(tenantId);
  }

  @Get(":customerId")
  @ApiOperation({ summary: "Consultar cliente" })
  async findOne(
    @Param("tenantId") tenantId: string,
    @Param("customerId") customerId: string,
  ) {
    return this.service.findOne(customerId, tenantId);
  }
}
