import { Controller, Post, Param, Body, Headers, BadRequestException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiHeader } from "@nestjs/swagger";
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
  @ApiHeader({ name: "Idempotency-Key", required: true })
  async create(
    @Param("invoiceId") invoiceId: string,
    @Headers("Idempotency-Key") idempotencyKey: string,
    @Body() dto: CreateDebitNoteDto,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("Idempotency-Key header is required");
    }
    return this.service.create(invoiceId, { ...dto, idempotencyKey });
  }
}
