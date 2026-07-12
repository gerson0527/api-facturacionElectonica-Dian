import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: Error | null, user: TUser | false): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    return user;
  }
}
