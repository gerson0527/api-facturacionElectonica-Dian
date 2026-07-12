import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
    const user = (req as any).user;

    if (headerTenantId) {
      (req as any).tenantId = headerTenantId;
    }

    if (headerTenantId && user && user.tenant_id && user.role !== 'super_admin') {
      if (headerTenantId !== user.tenant_id) {
        throw new ForbiddenException('X-Tenant-Id no coincide con el tenant del token JWT');
      }
    }

    next();
  }
}
