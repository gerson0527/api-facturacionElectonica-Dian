import { NestFactory } from "@nestjs/core";
import { QueueModule } from "./queue.module";
import { Logger } from "@nestjs/common";

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(QueueModule);
  const logger = new Logger("WorkerBootstrap");
  logger.log("BullMQ Worker started successfully");
}

bootstrapWorker().catch((err) => {
  Logger.error("Worker bootstrap failed", err.stack);
  process.exit(1);
});
