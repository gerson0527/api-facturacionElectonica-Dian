import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CreditNotesService } from './credit-notes.service';
import { IsString, IsNumber, IsDateString, IsOptional, Min } from 'class-validator';

export class CreateCreditNoteDto {
  @IsDateString()
  issueDate: string;

  @IsString()
  reasonCode: string;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsString()
  prefix: string;

  @IsOptional()
  @IsString()
  description?: string;
}

@ApiTags('Credit Notes')
@Controller('invoices/:invoiceId/credit-notes')
export class CreditNotesController {
  constructor(private readonly service: CreditNotesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nota crédito' })
  async create(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: CreateCreditNoteDto,
  ) {
    return this.service.create(invoiceId, dto);
  }
}
