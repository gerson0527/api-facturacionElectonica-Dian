import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const headerTenantId = request.headers['x-tenant-id'];
    if (!headerTenantId) {
      return true;
    }
    if (user && user.role === 'super_admin') {
      return true;
    }
    if (user && headerTenantId !== user.tenant_id) {
      throw new ForbiddenException('X-Tenant-Id no coincide con el token');
    }
    return true;
  }
}
