import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { WebhookEndpoint } from "@/database/entities/webhook-endpoint.entity";
import { WebhookDelivery } from "@/database/entities/webhook-delivery.entity";
import * as crypto from "crypto";
import { Tenant } from "@/database/entities/tenant.entity";

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(WebhookEndpoint)
    private readonly endpointRepo: Repository<WebhookEndpoint>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepo: Repository<WebhookDelivery>,
  ) {}

  async createEndpoint(tenantId: string, url: string, subscribedEvents: string[]): Promise<WebhookEndpoint> {
    const secret = crypto.randomBytes(32).toString("hex");
    const endpoint = this.endpointRepo.create({
      url,
      secret,
      subscribedEvents,
      tenant: { id: tenantId } as Tenant,
    });
    return this.endpointRepo.save(endpoint);
  }

  async listEndpoints(tenantId: string): Promise<WebhookEndpoint[]> {
    return this.endpointRepo.find({ where: { tenant: { id: tenantId } } });
  }

  async deleteEndpoint(tenantId: string, endpointId: string): Promise<void> {
    const result = await this.endpointRepo.delete({ id: endpointId, tenant: { id: tenantId } });
    if (result.affected === 0) {
      throw new NotFoundException("Webhook endpoint not found");
    }
  }

  async getDeliveries(tenantId: string): Promise<WebhookDelivery[]> {
    return this.deliveryRepo.find({
      where: { tenant: { id: tenantId } },
      order: { createdAt: "DESC" },
      take: 50,
      relations: ["endpoint"],
    });
  }
}
