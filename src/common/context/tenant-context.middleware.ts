import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantContext, TenantContextData } from './tenant-context';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    const user = (req as any).user;

    const context: TenantContextData = {
      tenantId: user?.tenant_id || (req.headers['x-tenant-id'] as string) || 'anonymous',
      userId: user?.sub || 'anonymous',
      role: user?.role || 'anonymous',
      requestId,
    };

    tenantContext.run(context, () => {
      next();
    });
  }
}
