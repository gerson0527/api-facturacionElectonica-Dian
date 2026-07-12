import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '@/common/decorators';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload & { email?: string }): Promise<JwtPayload> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token no es de tipo access');
    }
    return {
      sub: payload.sub,
      tenant_id: payload.tenant_id,
      role: payload.role,
      type: payload.type,
    };
  }
}
