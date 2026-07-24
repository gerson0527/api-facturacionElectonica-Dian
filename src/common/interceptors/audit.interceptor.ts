import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { AuditService } from "@/services/audit.service";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, path, ip, headers } = request;
    const user = request.user;
    const startTime = Date.now();

    const entityType = this.extractEntityType(path);
    const entityId = request.params?.id;

    return next.handle().pipe(
      tap(() => {
        const actor = user?.sub || "anonymous";
        const action = `${method} ${path}`;
        const duration = Date.now() - startTime;
        
        const resolvedTenantId = request.tenantId || user?.tenant_id || user?.tenantId;
        if (!resolvedTenantId) return;

        this.auditService
          .log({
            tenantId: resolvedTenantId,
            actor,
            action,
            entityType,
            entityId,
            details: { method, path, duration, statusCode: 200 },
            ipAddress: ip,
            userAgent: headers["user-agent"] || "",
          })
          .catch(() => {});
      }),
    );
  }

  private extractEntityType(path: string): string {
    const parts = path.split("/").filter(Boolean);
    if (parts.length >= 2 && parts[0] === "v1") {
      return parts[1];
    }
    return path;
  }
}
