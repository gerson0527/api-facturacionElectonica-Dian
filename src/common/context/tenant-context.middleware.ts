import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantContext, TenantContextData } from './tenant-context';
import { TenantRlsService } from '../database/tenant-rls.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private tenantRls: TenantRlsService) {}
  
  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    const user = (req as any).user;

    const context: TenantContextData = {
      tenantId: user?.tenant_id || 'anonymous',
      userId: user?.sub || 'anonymous',
      role: user?.role || 'anonymous',
      requestId,
    };

    tenantContext.run(context, async () => {
      if (user?.tenant_id) {
        try {
          await this.tenantRls.setSessionTenant(user.tenant_id);
        } catch (e) {
          // log but don't fail
        }
      }
      next();
    });
  }
}