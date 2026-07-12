import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { dataSourceOptions } from './config/database.config';
import { redisConfig } from './config/redis.config';

import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { SoftwareCredentialsModule } from './modules/software-credentials/software-credentials.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { NumberingRangesModule } from './modules/numbering-ranges/numbering-ranges.module';
import { CustomersModule } from './modules/customers/customers.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { CreditNotesModule } from './modules/credit-notes/credit-notes.module';
import { DebitNotesModule } from './modules/debit-notes/debit-notes.module';
import { DianSubmissionsModule } from './modules/dian-submissions/dian-submissions.module';
import { AuditModule } from './modules/audit/audit.module';
import { QueueModule } from './modules/queue/queue.module';
import { DianSubmissionProcessor } from './modules/queue/dian-submission.processor';
import { DianStatusProcessor } from './modules/queue/dian-status.processor';

import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuditService } from './services/audit.service';
import { DianSoapClient } from './services/dian-soap.client';
import { PdfQrService } from './services/pdf-qr.service';

import * as entities from './database/entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        entities: Object.values(entities),
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') === 'development',
        ssl: config.get<string>('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => ({
        connection: redisConfig,
      }),
    }),
    BullModule.registerQueue(
      { name: 'dian-submission' },
      { name: 'dian-status' },
    ),
    AuthModule,
    TenantsModule,
    SoftwareCredentialsModule,
    CertificatesModule,
    NumberingRangesModule,
    CustomersModule,
    InvoicesModule,
    CreditNotesModule,
    DebitNotesModule,
    DianSubmissionsModule,
    AuditModule,
    QueueModule,
    TypeOrmModule.forFeature(Object.values(entities)),
  ],
  providers: [
    DianSubmissionProcessor,
    DianStatusProcessor,
    AuditService,
    DianSoapClient,
    PdfQrService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
