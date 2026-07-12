import { TenantGuard } from './tenant.guard';
import { ForbiddenException } from '@nestjs/common';

describe('TenantGuard', () => {
  let guard: TenantGuard;

  beforeEach(() => {
    guard = new TenantGuard();
  });

  function mockContext(headerTenantId?: string, userTenantId?: string, userRole?: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-tenant-id': headerTenantId },
          user: userTenantId ? { tenant_id: userTenantId, role: userRole || 'tenant_user' } : undefined,
        }),
      }),
    } as any;
  }

  it('debe permitir si no hay X-Tenant-Id', () => {
    expect(guard.canActivate(mockContext(undefined, 'tenant-1'))).toBe(true);
  });

  it('debe permitir si X-Tenant-Id coincide con JWT tenant_id', () => {
    expect(guard.canActivate(mockContext('tenant-1', 'tenant-1'))).toBe(true);
  });

  it('debe permitir a super_admin aunque el tenant no coincida', () => {
    expect(guard.canActivate(mockContext('tenant-1', 'tenant-2', 'super_admin'))).toBe(true);
  });

  it('debe denegar si X-Tenant-Id no coincide con JWT tenant_id', () => {
    expect(() => guard.canActivate(mockContext('tenant-1', 'tenant-2'))).toThrow(ForbiddenException);
  });
});
