import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { AppConfigModule } from './config/config.module';

import { TenantContextMiddleware } from './common/context/tenant-context.middleware';
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
import { HealthModule } from './modules/health/health.module';
import { DianSubmissionProcessor } from './modules/queue/dian-submission.processor';
import { DianStatusProcessor } from './modules/queue/dian-status.processor';

import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuditService } from './services/audit.service';
import { DianSoapClient } from './services/dian-soap.client';
import { PdfQrService } from './services/pdf-qr.service';
import { CufeService } from './services/cufe.service';
import { XmlBuilderService } from './services/xml-builder.service';
import { SigningService } from './services/signing.service';
import { IdempotencyService } from './services/idempotency.service';
import { CryptoService } from './services/crypto.service';
import { ValidationsService } from './services/validations.service';
import { EnvSecretsProvider } from './services/secrets/env-secrets-provider';
import { SECRETS_PROVIDER_TOKEN } from './services/secrets/secrets-provider.interface';
import { DianOutboxService } from './services/dian-outbox.service';
import { StorageService } from './services/storage.service';

import * as entities from './database/entities';

function getSslConfig(config: ConfigService) {
  const nodeEnv = config.get<string>('NODE_ENV');
  if (nodeEnv !== 'production' && nodeEnv !== 'habilitacion') {
    return false;
  }
  const caCert = config.get<string>('DB_CA_CERT');
  if (caCert) {
    return {
      rejectUnauthorized: true,
      ca: caCert,
    };
  }
  return { rejectUnauthorized: true };
}

@Module({
  imports: [
    AppConfigModule,
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
        synchronize: config.get<string>('NODE_ENV') === 'development',
        logging: config.get<string>('NODE_ENV') === 'development',
        ssl: getSslConfig(config),
        maxQueryExecutionTime: 1000,
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: (config.get<number>('THROTTLER_TTL') || 60) * 1000,
            limit: config.get<number>('THROTTLER_LIMIT') || 30,
          },
        ],
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') || 'localhost',
          port: parseInt(config.get<string>('REDIS_PORT') || '6379', 10),
          maxRetriesPerRequest: null,
          connectTimeout: config.get<string>('NODE_ENV') === 'development' ? 3000 : 10000,
          retryStrategy: (times: number) => {
            if (config.get<string>('NODE_ENV') === 'development' && times > 1) return null;
            return Math.min(times * 200, 5000);
          },
        },
        defaultJobOptions: {
          removeOnComplete: { age: 86400, count: 100 },
          removeOnFail: { age: 604800, count: 500 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: 'dian-submission' },
      { name: 'dian-status' },
    ),
    HealthModule,
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
    CufeService,
    XmlBuilderService,
    SigningService,
    DianSoapClient,
    PdfQrService,
    IdempotencyService,
    CryptoService,
    ValidationsService,
    AuditService,
    DianOutboxService,
    StorageService,
    EnvSecretsProvider,
    { provide: SECRETS_PROVIDER_TOKEN, useClass: EnvSecretsProvider },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantContextMiddleware, TenantMiddleware, RequestLoggingMiddleware)
      .forRoutes('*');
  }
}
