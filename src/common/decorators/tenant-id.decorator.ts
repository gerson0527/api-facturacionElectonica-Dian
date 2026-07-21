import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    if (!req.tenantId) {
      throw new Error('TenantGuard must run before @TenantId()');
    }
    return req.tenantId;
  },
);