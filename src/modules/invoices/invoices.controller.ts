import {
  Controller, Post, Get, Param, Body, Query, Res, HttpCode, HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';
import {
  IsString, IsNumber, IsOptional, IsDateString, IsArray, ValidateNested, IsUUID, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import * as fs from 'fs';
import * as path from 'path';

class InvoiceLineDto {
  @IsNumber()
  @Min(1)
  lineNumber: number;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsString()
  unitCode?: string;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  lineExtensionAmount?: number;

  @IsOptional()
  @IsString()
  taxCode?: string;

  @IsOptional()
  @IsNumber()
  taxPercent?: number;

  @IsOptional()
  @IsNumber()
  taxAmount?: number;
}

class TaxTotalDto {
  @IsString()
  taxId: string;

  @IsNumber()
  taxPercent: number;

  @IsNumber()
  taxableAmount: number;

  @IsNumber()
  taxAmount: number;
}

export class CreateInvoiceDto {
  @IsOptional()
  @IsString()
  invoiceType?: string;

  @IsOptional()
  @IsString()
  paymentFormCode?: string;

  @IsOptional()
  @IsString()
  paymentMethodCode?: string;

  @IsDateString()
  issueDate: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsString()
  customerId: string;

  @IsString()
  prefix: string;

  @IsUUID()
  idempotencyKey: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines: InvoiceLineDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxTotalDto)
  taxTotals: TaxTotalDto[];
}

@ApiTags('Invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @Roles('tenant_admin', 'tenant_user')
  @ApiOperation({ summary: 'Crear factura (encola job BullMQ)' })
  async create(
    @Body() dto: CreateInvoiceDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invoicesService.create(tenantId || user.tenant_id, dto, user.sub);
  }

  @Get()
  @Roles('tenant_admin', 'tenant_user', 'tenant_viewer')
  @ApiOperation({ summary: 'Listar facturas (paginado)' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ) {
    return this.invoicesService.findAll(
      tenantId || user.tenant_id,
      { limit: limit ? parseInt(limit) : 50, offset: offset ? parseInt(offset) : 0, status },
    );
  }

  @Get(':id')
  @Roles('tenant_admin', 'tenant_user', 'tenant_viewer')
  @ApiOperation({ summary: 'Consultar factura' })
  async findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invoicesService.findOne(id, tenantId || user.tenant_id);
  }

  @Get(':id/status')
  @Roles('tenant_admin', 'tenant_user', 'tenant_viewer')
  @ApiOperation({ summary: 'Consultar estado DIAN' })
  async getStatus(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invoicesService.getDianStatus(id, tenantId || user.tenant_id);
  }

  @Get(':id/xml')
  @Roles('tenant_admin', 'tenant_user', 'tenant_viewer')
  @ApiOperation({ summary: 'Descargar XML firmado' })
  async downloadXml(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const invoice = await this.invoicesService.findOne(id, tenantId || user.tenant_id);
    if (!invoice.signedXmlPath) {
      return res.status(404).json({ message: 'XML no disponible' });
    }
    const filePath = path.resolve(invoice.signedXmlPath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Archivo XML no encontrado' });
    }
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="factura-${invoice.number}.xml"`);
    fs.createReadStream(filePath).pipe(res);
  }

  @Get(':id/pdf')
  @Roles('tenant_admin', 'tenant_user', 'tenant_viewer')
  @ApiOperation({ summary: 'Descargar PDF con QR' })
  async downloadPdf(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const invoice = await this.invoicesService.findOne(id, tenantId || user.tenant_id);
    if (!invoice.pdfPath) {
      return res.status(404).json({ message: 'PDF no disponible' });
    }
    const filePath = path.resolve(invoice.pdfPath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Archivo PDF no encontrado' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="factura-${invoice.number}.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  }

  @Post(':id/retry')
  @Roles('tenant_admin', 'tenant_user')
  @ApiOperation({ summary: 'Reintentar transmisión DIAN' })
  async retry(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.invoicesService.retrySubmission(id, tenantId || user.tenant_id);
  }
}
