import { Module } from "@nestjs/common";
import { MailerService } from "./mailer.service";
import { BullModule } from "@nestjs/bullmq";
import { MailerProcessor } from "./mailer.processor";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Tenant } from "@/database/entities/tenant.entity";
import { Invoice } from "@/database/entities/invoice.entity";
import { AttachedDocumentService } from "@/services/attached-document.service";
import { PdfQrService } from "@/services/pdf-qr.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Invoice]),
    BullModule.registerQueue({ name: "mailer" }),
  ],
  providers: [MailerService, MailerProcessor, AttachedDocumentService, PdfQrService],
  exports: [MailerService],
})
export class MailerModule {}
