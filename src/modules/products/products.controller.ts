import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantId } from '@/common/decorators/tenant-id.decorator';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.productsService.findAll(tenantId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() data: any) {
    return this.productsService.create(tenantId, data);
  }
}
