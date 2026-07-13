import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DianSoftwareCredential } from "@/database/entities/dian-software-credential.entity";
import { CustomersModule } from "@/modules/customers/customers.module";
import { InvoicesModule } from "@/modules/invoices/invoices.module";
import { CreditNotesModule } from "@/modules/credit-notes/credit-notes.module";
import { DebitNotesModule } from "@/modules/debit-notes/debit-notes.module";
import { OnboardingService } from "./onboarding.service";
import { OnboardingController } from "./onboarding.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([DianSoftwareCredential]),
    CustomersModule,
    InvoicesModule,
    CreditNotesModule,
    DebitNotesModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
