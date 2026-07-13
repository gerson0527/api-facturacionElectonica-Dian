import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantId } from '@/common/decorators/tenant-id.decorator';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('movements')
  findAll(@TenantId() tenantId: string) {
    return this.inventoryService.findAll(tenantId);
  }

  @Post('movements')
  create(@TenantId() tenantId: string, @Body() data: any) {
    return this.inventoryService.createMovement(tenantId, data);
  }
}
