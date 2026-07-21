import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan, IsNull } from "typeorm";
import { RefreshToken } from "@/database/entities/refresh-token.entity";

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly tokenRepo: Repository<RefreshToken>,
  ) {}

  async store(
    jti: string,
    userId: string,
    tenantId: string,
    expiresAt?: Date,
  ): Promise<void> {
    const finalExpiresAt =
      expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = this.tokenRepo.create({
      jti,
      userId,
      tenantId,
      expiresAt: finalExpiresAt,
    });
    await this.tokenRepo.upsert(token, ["jti"]);
  }

  /**
   * @deprecated Usar consumeAtomic() para evitar race conditions.
   * Mantenido solo por compatibilidad con código legacy.
   */
  async consume(jti: string): Promise<boolean> {
    const token = await this.tokenRepo.findOne({ where: { jti } });
    if (!token) return false;
    if (token.consumedAt) {
      await this.revokeFamily(token.userId);
      return false;
    }
    if (token.revokedAt) return false;
    token.consumedAt = new Date();
    await this.tokenRepo.save(token);
    return true;
  }

  async consumeAtomic(jti: string): Promise<RefreshToken | null> {
    const result = await this.tokenRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ consumedAt: () => "NOW()" })
      .where(
        "jti = :jti AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()",
        { jti },
      )
      .returning("*")
      .execute();

    if (!result.affected) {
      const token = await this.tokenRepo.findOne({ where: { jti } });
      if (token && token.consumedAt) {
        await this.revokeFamily(token.userId);
      }
      return null;
    }

    const updated = await this.tokenRepo.findOne({ where: { jti } });
    return updated;
  }

  async revoke(jti: string): Promise<void> {
    const token = await this.tokenRepo.findOne({ where: { jti } });
    if (token) {
      token.revokedAt = new Date();
      await this.tokenRepo.save(token);
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const tokens = await this.tokenRepo.find({
      where: { userId, consumedAt: IsNull(), revokedAt: IsNull() },
    });
    for (const t of tokens) {
      t.revokedAt = new Date();
    }
    await this.tokenRepo.save(tokens);
  }

  /**
   * @deprecated Mantenido por compatibilidad. La lógica de familia se invoca
   * desde consumeAtomic() ahora.
   */
  private async revokeFamily(userId: string): Promise<void> {
    this.logger.warn(
      `Revocando familia de tokens por posible robo: userId=${userId}`,
    );
    await this.revokeAllForUser(userId);
  }

  async cleanExpired(): Promise<number> {
    const result = await this.tokenRepo.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected || 0;
  }
}
