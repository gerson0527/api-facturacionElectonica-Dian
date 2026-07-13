import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantId } from '@/common/decorators/tenant-id.decorator';

@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.suppliersService.findAll(tenantId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() data: any) {
    return this.suppliersService.create(tenantId, data);
  }
}
