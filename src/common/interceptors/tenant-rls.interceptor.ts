import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { DataSource } from 'typeorm';
import { TenantRlsService } from '../database/tenant-rls.service';

@Injectable()
export class TenantRlsInterceptor implements NestInterceptor {
  constructor(
    private dataSource: DataSource,
    private tenantRls: TenantRlsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const tenantId = req.tenantId || req.user?.tenant_id;

    return from(this.tenantRls.setSessionTenant(tenantId)).pipe(
      switchMap(() => next.handle()),
      tap({
        finalize: () => {
          this.tenantRls.clearSessionTenant().catch(() => {});
        },
      }),
    );
  }
}