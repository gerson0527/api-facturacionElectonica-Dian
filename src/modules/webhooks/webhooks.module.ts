import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { WebhookEndpoint } from "@/database/entities/webhook-endpoint.entity";
import { WebhookDelivery } from "@/database/entities/webhook-delivery.entity";
import { WebhooksService } from "./webhooks.service";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksProcessor } from "./webhooks.processor";

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookEndpoint, WebhookDelivery]),
    BullModule.registerQueue({ name: "webhooks" }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhooksProcessor],
  exports: [WebhooksService],
})
export class WebhooksModule {}
