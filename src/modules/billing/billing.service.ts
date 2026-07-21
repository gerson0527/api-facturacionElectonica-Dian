import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Plan } from "../../database/entities/plan.entity";
import { Subscription } from "../../database/entities/subscription.entity";
import { BillingEvent } from "../../database/entities/billing-event.entity";
import { MercadoPagoService } from "./mercadopago.service";

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Plan) private planRepo: Repository<Plan>,
    @InjectRepository(Subscription) private subRepo: Repository<Subscription>,
    @InjectRepository(BillingEvent) private eventRepo: Repository<BillingEvent>,
    private mp: MercadoPagoService,
  ) {}

  async listPlans(): Promise<Plan[]> {
    return this.planRepo.find({ where: { isActive: true }, order: { priceMonthly: "ASC" } });
  }

  async getSubscription(tenantId: string): Promise<Subscription | null> {
    return this.subRepo.findOne({
      where: { tenantId },
      relations: ["plan"],
    });
  }

  async createTrialSubscription(tenantId: string, planCode = "free"): Promise<Subscription> {
    const plan = await this.planRepo.findOne({ where: { code: planCode } });
    if (!plan) throw new NotFoundException(`Plan ${planCode} not found`);

    const existing = await this.subRepo.findOne({ where: { tenantId } });
    if (existing) return existing;

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const sub = this.subRepo.create({
      tenantId,
      planId: plan.id,
      status: "trialing",
      period: "monthly",
      trialEndsAt,
    });
    return this.subRepo.save(sub);
  }

  async changePlan(tenantId: string, newPlanCode: string): Promise<Subscription> {
    const plan = await this.planRepo.findOne({ where: { code: newPlanCode } });
    if (!plan) throw new NotFoundException(`Plan ${newPlanCode} not found`);

    const sub = await this.subRepo.findOne({ where: { tenantId } });
    if (!sub) throw new NotFoundException("No subscription");

    sub.planId = plan.id;
    sub.status = plan.code === "free" ? "active" : sub.status;
    sub.currentPeriodStart = new Date();
    sub.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.subRepo.save(sub);

    await this.eventRepo.save(this.eventRepo.create({
      tenantId,
      subscriptionId: sub.id,
      type: "subscription.activated",
      payload: { planCode: newPlanCode },
      status: "processed",
    }));

    return sub;
  }

  async cancel(tenantId: string): Promise<Subscription> {
    const sub = await this.subRepo.findOne({ where: { tenantId } });
    if (!sub) throw new NotFoundException("No subscription");
    sub.status = "canceled";
    sub.canceledAt = new Date();
    await this.subRepo.save(sub);
    await this.eventRepo.save(this.eventRepo.create({
      tenantId,
      subscriptionId: sub.id,
      type: "subscription.canceled",
      status: "processed",
    }));
    return sub;
  }

  async checkLimit(
    tenantId: string,
    limit: "invoices" | "products" | "users" | "cash_registers",
  ): Promise<{ allowed: boolean; current: number; cap: number | null }> {
    const sub = await this.subRepo.findOne({ where: { tenantId }, relations: ["plan"] });
    if (!sub) return { allowed: true, current: 0, cap: null };

    const plan = sub.plan;
    let cap: number;
    switch (limit) {
      case "invoices": cap = plan.maxInvoicesPerMonth; break;
      case "products": cap = plan.maxProducts; break;
      case "users": cap = plan.maxUsers; break;
      case "cash_registers": cap = plan.maxCashRegisters; break;
      default: cap = 999999;
    }

    return { allowed: true, current: 0, cap };
  }

  async createPreference(tenantId: string, planCode: string, period: "monthly" | "yearly") {
    const plan = await this.planRepo.findOne({ where: { code: planCode } });
    if (!plan) throw new NotFoundException(`Plan ${planCode} not found`);

    const price = period === "yearly" ? Number(plan.priceYearly) : Number(plan.priceMonthly);

    return this.mp.createPreference({
      items: [{
        title: `Suscripción ${plan.name} (${period})`,
        quantity: 1,
        unit_price: price,
        currency_id: plan.currency,
      }],
      external_reference: `${tenantId}:${planCode}:${period}`,
      notification_url: `${process.env.PUBLIC_BACKEND_URL}/v1/billing/webhooks/mercadopago`,
      metadata: { tenantId, planCode, period },
    });
  }
}
