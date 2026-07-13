import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DianSubmissionsController } from "./dian-submissions.controller";
import { DianSubmissionsService } from "./dian-submissions.service";
import { DianSubmission } from "@/database/entities/dian-submission.entity";
import { Invoice } from "@/database/entities/invoice.entity";
import { DianSoapClient } from "@/services/dian-soap.client";

@Module({
  imports: [TypeOrmModule.forFeature([DianSubmission, Invoice])],
  controllers: [DianSubmissionsController],
  providers: [DianSubmissionsService, DianSoapClient],
  exports: [DianSubmissionsService],
})
export class DianSubmissionsModule {}
