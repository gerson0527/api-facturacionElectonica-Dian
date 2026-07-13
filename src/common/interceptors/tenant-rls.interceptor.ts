import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { finalize } from "rxjs/operators";
import { TenantRlsService } from "../database/tenant-rls.service";
import { getTenantContext } from "../context/tenant-context";

@Injectable()
export class TenantRlsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantRlsInterceptor.name);

  constructor(private readonly tenantRls: TenantRlsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = getTenantContext();
    const tenantId = ctx?.tenantId;

    if (!tenantId || tenantId === "anonymous") {
      return next.handle();
    }

    this.tenantRls.setSessionTenant(tenantId).catch((err) => {
      this.logger.error(`Failed to set RLS context: ${err.message}`);
    });

    return next.handle().pipe(
      finalize(() => {
        this.tenantRls.clearSessionTenant().catch((err) => {
          this.logger.error(`Failed to clear RLS context: ${err.message}`);
        });
      }),
    );
  }
}
