import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authentication required');

    const headerTenantId = request.headers['x-tenant-id'] as string | undefined;
    const userTenantId = user.tenant_id;

    if (user.role === 'super_admin') {
      request.tenantId = headerTenantId || userTenantId;
      return true;
    }

    if (headerTenantId && headerTenantId !== userTenantId) {
      throw new ForbiddenException('Tenant mismatch: header does not match token');
    }
    request.tenantId = userTenantId;
    return true;
  }
}