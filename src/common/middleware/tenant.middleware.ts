import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const user = (req as any).user;
    if (user) {
      (req as any).tenantId = user.tenant_id;
    }
    next();
  }
}