import { Injectable, UnauthorizedException, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { StringValue } from "ms";
import { User } from "@/database/entities/user.entity";
import { Tenant } from "@/database/entities/tenant.entity";
import { RefreshTokenService } from "./refresh-token.service";
import { parseTtl } from "@/common/ttl.util";

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
    private readonly configService: ConfigService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userRepo.findOne({
      where: { email, isActive: true },
      relations: ["tenant"],
    });
    if (!user) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        "Cuenta bloqueada temporalmente por muchos intentos fallidos",
      );
    }

    const valid = await bcrypt.compare(password, user.hashedPassword);
    if (!valid) {
      user.failedAttempts += 1;
      if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        this.logger.warn(
          `Cuenta bloqueada: email=${email}, tenantId=${user.tenantId}`,
        );
      }
      await this.userRepo.save(user);
      throw new UnauthorizedException("Credenciales inválidas");
    }

    if (user.failedAttempts > 0) {
      user.failedAttempts = 0;
      user.lockedUntil = null;
      await this.userRepo.save(user);
    }

    return this.generateTokens(user);
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (payload.type !== "refresh") {
      throw new UnauthorizedException("Token type mismatch");
    }

    if (!payload.jti) {
      throw new UnauthorizedException("Missing jti");
    }

    const stored = await this.refreshTokenService.consumeAtomic(payload.jti);
    if (!stored) {
      throw new UnauthorizedException("Refresh token revoked or expired");
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub, isActive: true },
      relations: ["tenant"],
    });
    if (!user) {
      throw new UnauthorizedException("Usuario no encontrado");
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

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId, isActive: true },
      relations: ["tenant"],
    });
    if (!user) throw new UnauthorizedException("Usuario no encontrado");
    return {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenant?.name ?? null,
    };
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

  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessTtl =
      this.configService.get<string>("JWT_ACCESS_EXPIRATION") || "15m";
    const refreshTtl =
      this.configService.get<string>("JWT_REFRESH_EXPIRATION") || "7d";

    const jti = randomBytes(16).toString("hex");
    const basePayload = {
      sub: user.id,
      tenant_id: user.tenantId,
      role: user.role,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(
      { ...basePayload, type: "access" },
      {
        secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: accessTtl as StringValue,
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id, tenant_id: user.tenantId, type: "refresh", jti },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: refreshTtl as StringValue,
      },
    );

    const expiresAt = new Date(Date.now() + parseTtl(refreshTtl));
    await this.refreshTokenService.store(jti, user.id, user.tenantId, expiresAt);

    return { accessToken, refreshToken };
  }
}
