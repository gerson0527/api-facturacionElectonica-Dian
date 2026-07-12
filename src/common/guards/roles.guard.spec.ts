import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function mockContext(role: string, requiredRoles?: string[]) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role } }),
      }),
    } as any;
  }

  beforeEach(() => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
  });

  it('debe permitir acceso si no hay roles requeridos', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext('tenant_viewer'))).toBe(true);
  });

  it('debe permitir acceso a tenant_admin para rol tenant_admin', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['tenant_admin']);
    expect(guard.canActivate(mockContext('tenant_admin'))).toBe(true);
  });

  it('debe permitir acceso a super_admin para cualquier rol', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['tenant_admin']);
    expect(guard.canActivate(mockContext('super_admin'))).toBe(true);
  });

  it('debe denegar acceso a tenant_viewer para rol tenant_admin', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['tenant_admin']);
    expect(() => guard.canActivate(mockContext('tenant_viewer'))).toThrow(ForbiddenException);
  });

  it('debe permitir acceso a tenant_user para rol tenant_user', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['tenant_user']);
    expect(guard.canActivate(mockContext('tenant_user'))).toBe(true);
  });

  it('debe lanzar ForbiddenException si no hay usuario', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['tenant_admin']);
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user: null }) }),
    } as any;
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
