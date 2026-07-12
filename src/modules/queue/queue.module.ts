import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'dian-submission' },
      { name: 'dian-status' },
    ),
  ],
})
export class QueueModule implements OnModuleInit {
  private readonly logger = new Logger(QueueModule.name);

  async onModuleInit() {
    this.logger.log('BullMQ queues initialized: dian-submission, dian-status');
  }
}
