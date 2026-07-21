import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Plan } from "../../database/entities/plan.entity";
import { Subscription } from "../../database/entities/subscription.entity";
import { BillingEvent } from "../../database/entities/billing-event.entity";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { MercadoPagoService } from "./mercadopago.service";
import { WebhookController } from "./webhook.controller";
import { BillingSuspensionService } from "./billing-suspension.service";

@Module({
  imports: [TypeOrmModule.forFeature([Plan, Subscription, BillingEvent])],
  providers: [BillingService, MercadoPagoService, BillingSuspensionService],
  controllers: [BillingController, WebhookController],
  exports: [BillingService],
})
export class BillingModule {}
