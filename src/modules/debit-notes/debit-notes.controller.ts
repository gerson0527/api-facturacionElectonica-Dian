import { Controller, Post, Param, Body } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { DebitNotesService } from "./debit-notes.service";
import { IsString, IsNumber, IsDateString, Min } from "class-validator";

export class CreateDebitNoteDto {
  @IsDateString()
  issueDate: string;

  @IsString()
  reasonCode: string;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsString()
  prefix: string;
}

@ApiTags("Debit Notes")
@Controller("invoices/:invoiceId/debit-notes")
export class DebitNotesController {
  constructor(private readonly service: DebitNotesService) {}

  @Post()
  @ApiOperation({ summary: "Crear nota débito" })
  async create(
    @Param("invoiceId") invoiceId: string,
    @Body() dto: CreateDebitNoteDto,
  ) {
    return this.service.create(invoiceId, dto);
  }
}
