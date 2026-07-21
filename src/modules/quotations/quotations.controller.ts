import { Controller, Get, Post, Body, Param, UseGuards, Put } from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { TenantId } from '@/common/decorators/tenant-id.decorator';

@Controller('quotations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuotationsController {
  constructor(private readonly service: QuotationsService) {}

  @Post()
  async create(@TenantId() tenantId: string, @Body() body: any) {
    return this.service.create(tenantId, body);
  }

  @Get()
  async findAll(@TenantId() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Put(':id/status')
  async updateStatus(@TenantId() tenantId: string, @Param('id') id: string, @Body('status') status: string) {
    return this.service.updateStatus(tenantId, id, status as any);
  }
}
