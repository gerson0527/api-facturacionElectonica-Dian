import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryService {
  private readonly logger = new Logger('Sentry');
  private initialized = false;

  constructor(private config: ConfigService) {
    const dsn = this.config.get('SENTRY_DSN');
    if (!dsn) {
      this.logger.warn('SENTRY_DSN not configured - Sentry disabled');
      return;
    }
    Sentry.init({
      dsn,
      environment: this.config.get('NODE_ENV') || 'development',
      tracesSampleRate: 0.1,
      beforeSend(event) {
        // Redact password/PIN/jwt fields
        if (event.request?.data) {
          const data = typeof event.request.data === 'string'
            ? JSON.parse(event.request.data)
            : event.request.data;
          if (data.password) data.password = '[REDACTED]';
          if (data.pin) data.pin = '[REDACTED]';
          if (data.refreshToken) data.refreshToken = '[REDACTED]';
          event.request.data = data;
        }
        if (event.request?.cookies) {
          const cookies = event.request.cookies;
          for (const k of Object.keys(cookies)) {
            if (k.includes('access') || k.includes('refresh')) cookies[k] = '[REDACTED]';
          }
        }
        return event;
      },
    });
    this.initialized = true;
    this.logger.log('Sentry initialized');
  }

  captureException(error: Error, context?: Record<string, any>): void {
    if (this.initialized) {
      Sentry.captureException(error, { extra: context });
    }
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (this.initialized) {
      Sentry.captureMessage(message, level);
    }
  }
}
