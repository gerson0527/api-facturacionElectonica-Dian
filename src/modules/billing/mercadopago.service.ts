import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger("MercadoPago");
  private readonly accessToken: string;

  constructor(private config: ConfigService) {
    this.accessToken = this.config.get("MP_ACCESS_TOKEN") || "";
    if (!this.accessToken) {
      this.logger.warn("MP_ACCESS_TOKEN not configured");
    }
  }

  async createPreference(data: any): Promise<any> {
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `${data.metadata?.tenantId}-${data.metadata?.planCode}-${Date.now()}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`MP preference failed: ${err}`);
      throw new Error(`MercadoPago error: ${res.status}`);
    }

    return res.json();
  }

  async getPayment(paymentId: string): Promise<any> {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`MP getPayment failed: ${res.status}`);
    return res.json();
  }

  verifyWebhookSignature(req: any, xSignature: string, xRequestId: string): boolean {
    const secret = this.config.get("MP_WEBHOOK_SECRET");
    if (!secret) {
      this.logger.warn("MP_WEBHOOK_SECRET not configured - skipping signature verification");
      return process.env.NODE_ENV !== "production";
    }

    const crypto = require("crypto");
    const parts = xSignature.split(",");
    let ts = "";
    let hash = "";
    for (const part of parts) {
      const [key, value] = part.split("=");
      if (key === "ts") ts = value;
      if (key === "v1") hash = value;
    }
    const dataId = req.body?.data?.id || "";
    const expected = crypto.createHmac("sha256", secret).update(`${ts}${dataId}`).digest("hex");
    return hash === expected;
  }
}
