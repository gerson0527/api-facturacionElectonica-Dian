import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { DianSubmissionsService } from "./dian-submissions.service";

@ApiTags("DIAN Submissions")
@Controller("submissions")
export class DianSubmissionsController {
  constructor(private readonly service: DianSubmissionsService) {}

  @Get(":id")
  @ApiOperation({ summary: "Consultar estado de envío DIAN" })
  async findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Get("invoice/:invoiceId")
  @ApiOperation({ summary: "Listar envíos de una factura" })
  async findByInvoice(@Param("invoiceId") invoiceId: string) {
    return this.service.findByInvoice(invoiceId);
  }
}
