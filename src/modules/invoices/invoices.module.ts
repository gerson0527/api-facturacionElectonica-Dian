import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { Invoice } from "@/database/entities/invoice.entity";
import { InvoiceLine } from "@/database/entities/invoice-line.entity";
import { TaxTotal } from "@/database/entities/tax-total.entity";
import { NumberingRange } from "@/database/entities/numbering-range.entity";
import { DianSoftwareCredential } from "@/database/entities/dian-software-credential.entity";
import { DigitalCertificate } from "@/database/entities/digital-certificate.entity";
import { DianSubmission } from "@/database/entities/dian-submission.entity";
import { Customer } from "@/database/entities/customer.entity";
import { Tenant } from "@/database/entities/tenant.entity";
import { CufeService } from "@/services/cufe.service";
import { XmlBuilderService } from "@/services/xml-builder.service";
import { SigningService } from "@/services/signing.service";
import { DianSoapClient } from "@/services/dian-soap.client";
import { PdfQrService } from "@/services/pdf-qr.service";
import { IdempotencyService } from "@/services/idempotency.service";
import { CryptoService } from "@/services/crypto.service";
import { ValidationsService } from "@/services/validations.service";
import { SoftwareCredentialsService } from "../software-credentials/software-credentials.service";
import { CertificatesService } from "../certificates/certificates.service";
import { NumberingRangesService } from "../numbering-ranges/numbering-ranges.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceLine,
      TaxTotal,
      NumberingRange,
      DianSoftwareCredential,
      DigitalCertificate,
      DianSubmission,
      Customer,
      Tenant,
    ]),
    BullModule.registerQueue(
      { name: "dian-submission" },
      { name: "dian-status" },
    ),
  ],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    CufeService,
    XmlBuilderService,
    SigningService,
    DianSoapClient,
    PdfQrService,
    IdempotencyService,
    CryptoService,
    ValidationsService,
    SoftwareCredentialsService,
    CertificatesService,
    NumberingRangesService,
  ],
  exports: [InvoicesService],
})
export class InvoicesModule {}
