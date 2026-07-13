import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { WebhookEndpoint } from "@/database/entities/webhook-endpoint.entity";
import { WebhookDelivery } from "@/database/entities/webhook-delivery.entity";
import axios from "axios";
import * as crypto from "crypto";
import { Tenant } from "@/database/entities/tenant.entity";

@Injectable()
@Processor("webhooks")
export class WebhooksProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhooksProcessor.name);

  constructor(
    @InjectRepository(WebhookEndpoint)
    private readonly endpointRepo: Repository<WebhookEndpoint>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepo: Repository<WebhookDelivery>,
  ) {
    super();
  }

  async process(
    job: Job<{
      tenantId: string;
      event: string;
      payload: any;
      invoiceId?: string;
    }>,
  ): Promise<any> {
    const { tenantId, event, payload, invoiceId } = job.data;
    
    const endpoints = await this.endpointRepo.find({
      where: { tenant: { id: tenantId }, isActive: true },
    });

    for (const endpoint of endpoints) {
      if (
        endpoint.subscribedEvents &&
        endpoint.subscribedEvents.length > 0 &&
        !endpoint.subscribedEvents.includes(event) &&
        !endpoint.subscribedEvents.includes("*")
      ) {
        continue;
      }

      this.logger.log(`Dispatching webhook ${event} to ${endpoint.url}`);
      
      const delivery = this.deliveryRepo.create({
        event,
        payload,
        status: "pending",
        attempts: 1,
        invoiceId,
        endpoint,
        tenant: { id: tenantId } as Tenant,
      });

      const savedDelivery = await this.deliveryRepo.save(delivery);

      const timestamp = Date.now().toString();
      const stringifiedPayload = JSON.stringify(payload);
      
      const signaturePayload = `${timestamp}.${stringifiedPayload}`;
      const signature = crypto
        .createHmac("sha256", endpoint.secret)
        .update(signaturePayload)
        .digest("hex");

      const startTime = Date.now();
      try {
        const response = await axios.post(endpoint.url, stringifiedPayload, {
          headers: {
            "Content-Type": "application/json",
            "x-webhook-signature": `t=${timestamp},v1=${signature}`,
            "x-webhook-event": event,
            "x-webhook-delivery": savedDelivery.id,
          },
          timeout: 10000,
        });

        await this.deliveryRepo.update(savedDelivery.id, {
          status: "success",
          statusCode: response.status,
          responseBody: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
          responseTimeMs: Date.now() - startTime,
        });
        
        this.logger.log(`Webhook delivery ${savedDelivery.id} succeeded with status ${response.status}`);
      } catch (error: any) {
        const status = error.response?.status;
        const responseBody = error.response?.data 
          ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
          : error.message;

        await this.deliveryRepo.update(savedDelivery.id, {
          status: "failed",
          statusCode: status || 0,
          responseBody,
          responseTimeMs: Date.now() - startTime,
        });

        this.logger.error(`Webhook delivery ${savedDelivery.id} failed: ${error.message}`);
      }
    }
  }
}
