import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RadianEvent } from "@/database/entities/radian-event.entity";
import { Invoice } from "@/database/entities/invoice.entity";
import { OutboxEvent } from "@/database/entities/outbox-event.entity";
import { DianSubmission } from "@/database/entities/dian-submission.entity";
import { RadianService } from "./radian.service";
import { RadianController } from "./radian.controller";
import { CufeService } from "@/services/cufe.service";
import { TenantRlsService } from "@/common/database/tenant-rls.service";
import { StorageService } from "@/services/storage.service";
import { XmlRadianBuilderService } from "@/services/xml-radian-builder.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([RadianEvent, Invoice, OutboxEvent, DianSubmission]),
  ],
  controllers: [RadianController],
  providers: [RadianService, CufeService, TenantRlsService, StorageService, XmlRadianBuilderService],
  exports: [RadianService],
})
export class RadianModule {}
