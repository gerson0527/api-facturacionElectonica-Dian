import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { StringValue } from 'ms';
import { User } from '@/database/entities/user.entity';
import { Tenant } from '@/database/entities/tenant.entity';
import { RefreshTokenService } from './refresh-token.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userRepo.findOne({
      where: { email, isActive: true },
      relations: ['tenant'],
    });
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Cuenta bloqueada temporalmente por muchos intentos fallidos');
    }

    const valid = await bcrypt.compare(password, user.hashedPassword);
    if (!valid) {
      user.failedAttempts += 1;
      if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        this.logger.warn(`Cuenta bloqueada: email=${email}, tenantId=${user.tenantId}`);
      }
      await this.userRepo.save(user);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.failedAttempts > 0) {
      user.failedAttempts = 0;
      user.lockedUntil = null;
      await this.userRepo.save(user);
    }

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const jti = payload.jti;
    if (!jti) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const stored = await this.refreshTokenService.consume(jti);
    if (!stored) {
      this.logger.warn(`Intento de reutilización de refresh token: jti=${jti}`);
      throw new UnauthorizedException('Refresh token inválido o ya utilizado');
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub, isActive: true },
      relations: ['tenant'],
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return this.generateTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      if (payload.jti) {
        await this.refreshTokenService.revoke(payload.jti);
      }
    } catch {
      // Token inválido o expirado, ignorar
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenService.revokeAllForUser(userId);
  }

  async createUser(
    tenantId: string,
    email: string,
    password: string,
    fullName: string,
    role: string,
  ): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({
      tenantId,
      email,
      hashedPassword,
      fullName,
      role,
      isActive: true,
      failedAttempts: 0,
    });
    return this.userRepo.save(user);
  }

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const jti = randomBytes(16).toString('hex');
    const payload = {
      sub: user.id,
      tenant_id: user.tenantId,
      role: user.role,
      email: user.email,
    };

    const accessToken = this.jwtService.sign({ ...payload, type: 'access' });
    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh', jti },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRATION || '7d') as StringValue,
      },
    );

    await this.refreshTokenService.store(jti, user.id, user.tenantId);

    return { accessToken, refreshToken };
  }
}
