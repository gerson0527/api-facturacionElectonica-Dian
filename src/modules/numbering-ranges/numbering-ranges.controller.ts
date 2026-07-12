import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NumberingRangesService } from './numbering-ranges.service';
import { IsString, IsNumber, Min } from 'class-validator';

export class CreateNumberingRangeDto {
  @IsString()
  prefix: string;

  @IsNumber()
  @Min(1)
  fromNumber: number;

  @IsNumber()
  @Min(1)
  toNumber: number;

  @IsString()
  resolutionNumber: string;

  @IsString()
  resolutionDate: string;
}

@ApiTags('Numbering Ranges')
@Controller('tenants/:tenantId/numbering-ranges')
export class NumberingRangesController {
  constructor(private readonly service: NumberingRangesService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar rango de numeración' })
  async create(@Param('tenantId') tenantId: string, @Body() dto: CreateNumberingRangeDto) {
    return this.service.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar rangos de numeración' })
  async findAll(@Param('tenantId') tenantId: string) {
    return this.service.findByTenant(tenantId);
  }
}
