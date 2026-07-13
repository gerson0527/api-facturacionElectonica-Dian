import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { CreditNotesController } from "./credit-notes.controller";
import { CreditNotesService } from "./credit-notes.service";
import { CreditNote } from "@/database/entities/credit-note.entity";
import { Invoice } from "@/database/entities/invoice.entity";
import { NumberingRange } from "@/database/entities/numbering-range.entity";
import { DianSoftwareCredential } from "@/database/entities/dian-software-credential.entity";
import { DigitalCertificate } from "@/database/entities/digital-certificate.entity";
import { DianSubmission } from "@/database/entities/dian-submission.entity";
import { Tenant } from "@/database/entities/tenant.entity";
import { CufeService } from "@/services/cufe.service";
import { XmlBuilderService } from "@/services/xml-builder.service";
import { SigningService } from "@/services/signing.service";
import { DianSoapClient } from "@/services/dian-soap.client";
import { PdfQrService } from "@/services/pdf-qr.service";
import { CryptoService } from "@/services/crypto.service";
import { SoftwareCredentialsService } from "../software-credentials/software-credentials.service";
import { CertificatesService } from "../certificates/certificates.service";
import { NumberingRangesService } from "../numbering-ranges/numbering-ranges.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreditNote,
      Invoice,
      NumberingRange,
      DianSoftwareCredential,
      DigitalCertificate,
      DianSubmission,
      Tenant,
    ]),
    BullModule.registerQueue(
      { name: "dian-submission" },
      { name: "dian-status" },
    ),
  ],
  controllers: [CreditNotesController],
  providers: [
    CreditNotesService,
    CufeService,
    XmlBuilderService,
    SigningService,
    DianSoapClient,
    PdfQrService,
    CryptoService,
    SoftwareCredentialsService,
    CertificatesService,
    NumberingRangesService,
  ],
  exports: [CreditNotesService],
})
export class CreditNotesModule {}
