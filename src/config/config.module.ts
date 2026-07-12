import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { envValidationSchema } from './env.validation';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: true, allowUnknown: true },
      envFilePath: '.env',
    }),
  ],
  exports: [NestConfigModule],
})
export class AppConfigModule {}
