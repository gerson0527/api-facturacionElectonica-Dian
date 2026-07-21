import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>('roles', [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest();
    if (!req.user) throw new ForbiddenException('No user in request');
    const userRole = req.user.role;
    if (!required.includes(userRole)) {
      throw new ForbiddenException(`Requires role: ${required.join(' or ')}`);
    }
    return true;
  }
}