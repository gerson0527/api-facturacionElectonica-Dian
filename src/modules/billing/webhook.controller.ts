import { Body, Controller, Headers, HttpCode, Post, Req } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BillingEvent } from "../../database/entities/billing-event.entity";
import { Subscription } from "../../database/entities/subscription.entity";
import { MercadoPagoService } from "./mercadopago.service";

@Controller("billing/webhooks")
export class WebhookController {
  constructor(
    @InjectRepository(BillingEvent) private eventRepo: Repository<BillingEvent>,
    @InjectRepository(Subscription) private subRepo: Repository<Subscription>,
    private mp: MercadoPagoService,
  ) {}

  @Post("mercadopago")
  @HttpCode(200)
  async mercadopago(
    @Req() req: any,
    @Body() body: any,
    @Headers("x-signature") signature: string,
    @Headers("x-request-id") requestId: string,
  ) {
    if (!this.mp.verifyWebhookSignature(req, signature, requestId)) {
      return { ok: false, error: "invalid_signature" };
    }

    const paymentId = body?.data?.id;
    if (!paymentId) return { ok: true };

    const existing = await this.eventRepo.findOne({
      where: { mpPaymentId: String(paymentId), type: "payment.received", status: "processed" },
    });
    if (existing) return { ok: true, duplicate: true };

    try {
      const payment = await this.mp.getPayment(paymentId);
      const [tenantId, planCode, period] = (payment.external_reference || "").split(":");

      if (tenantId && payment.status === "approved") {
        const sub = await this.subRepo.findOne({ where: { tenantId } });
        if (sub) {
          sub.status = "active";
          sub.currentPeriodStart = new Date();
          sub.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          sub.mpPreapprovalId = payment.id;
          await this.subRepo.save(sub);
        }

        await this.eventRepo.save(this.eventRepo.create({
          tenantId,
          subscriptionId: sub?.id,
          type: "payment.received",
          payload: payment,
          mpPaymentId: String(paymentId),
          status: "processed",
        }));
      }
    } catch (e) {
      await this.eventRepo.save(this.eventRepo.create({
        tenantId: "unknown",
        type: "payment.failed",
        payload: { error: String(e), body },
        mpPaymentId: String(paymentId),
        status: "failed",
      }));
    }

    return { ok: true };
  }
}
