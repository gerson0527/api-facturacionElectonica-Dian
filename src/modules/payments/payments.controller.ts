import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '@/common/decorators';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los pagos del tenant' })
  async findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user.tenant_id);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo pago o recibo de caja' })
  async create(@CurrentUser() user: JwtPayload, @Body() data: any) {
    return this.service.create(user.tenant_id, data);
  }
}
