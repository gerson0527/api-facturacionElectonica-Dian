import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan, Not, In } from "typeorm";
import { Subscription } from "../../database/entities/subscription.entity";
import { BillingEvent } from "../../database/entities/billing-event.entity";

@Injectable()
export class BillingSuspensionService {
  private readonly logger = new Logger("BillingSuspension");

  constructor(
    @InjectRepository(Subscription) private subRepo: Repository<Subscription>,
    @InjectRepository(BillingEvent) private eventRepo: Repository<BillingEvent>,
  ) {}

  /**
   * Cada día a las 00:00 UTC:
   *  - Suspende suscripciones con `current_period_end < now` y status='past_due'
   *  - Marca trials expirados como 'canceled' si no se activaron
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailySuspensionCheck(): Promise<void> {
    this.logger.log("Running daily suspension check");

    const now = new Date();

    // Trials expirados sin activar
    const expiredTrials = await this.subRepo.find({
      where: {
        status: In(["trialing"]),
        trialEndsAt: LessThan(now),
      },
    });
    for (const sub of expiredTrials) {
      sub.status = "canceled";
      sub.canceledAt = now;
      await this.subRepo.save(sub);
      await this.eventRepo.save(
        this.eventRepo.create({
          tenantId: sub.tenantId,
          subscriptionId: sub.id,
          type: "subscription.canceled",
          payload: { reason: "trial_expired" },
          status: "processed",
        }),
      );
      this.logger.warn(`Trial expired for tenant ${sub.tenantId}`);
    }

    // Suspender past_due > 7 días
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const overdue = await this.subRepo.find({
      where: {
        status: "past_due",
        currentPeriodEnd: LessThan(sevenDaysAgo),
      },
    });
    for (const sub of overdue) {
      sub.status = "suspended";
      await this.subRepo.save(sub);
      await this.eventRepo.save(
        this.eventRepo.create({
          tenantId: sub.tenantId,
          subscriptionId: sub.id,
          type: "subscription.suspended",
          payload: { reason: "payment_overdue_7_days" },
          status: "processed",
        }),
      );
      this.logger.warn(`Suspended tenant ${sub.tenantId} (overdue 7+ days)`);
    }
  }
}