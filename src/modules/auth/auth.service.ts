import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { StringValue } from 'ms';
import { User } from '@/database/entities/user.entity';
import { Tenant } from '@/database/entities/tenant.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userRepo.findOne({
      where: { email, isActive: true },
      relations: ['tenant'],
    });
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await bcrypt.compare(password, user.hashedPassword);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return this.generateTokens(user);
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      const user = await this.userRepo.findOne({
        where: { id: payload.sub, isActive: true },
        relations: ['tenant'],
      });
      if (!user) {
        throw new UnauthorizedException('Usuario no encontrado');
      }
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
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
    });
    return this.userRepo.save(user);
  }

  private generateTokens(user: User): { accessToken: string; refreshToken: string } {
    const payload = {
      sub: user.id,
      tenant_id: user.tenantId,
      role: user.role,
      email: user.email,
    };

    const accessToken = this.jwtService.sign({ ...payload, type: 'access' });
    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRATION || '7d') as StringValue,
      },
    );
    return { accessToken, refreshToken };
  }
}
