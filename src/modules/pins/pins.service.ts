import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { UserPin } from '../../database/entities/user-pin.entity';

@Injectable()
export class PinsService {
  private readonly MAX_ATTEMPTS = 3;
  private readonly LOCKOUT_MINUTES = 15;
  private readonly PIN_MIN_LENGTH = 4;
  private readonly PIN_MAX_LENGTH = 8;

  constructor(@InjectRepository(UserPin) private repo: Repository<UserPin>) {}

  async setPin(tenantId: string, userId: string, pin: string): Promise<void> {
    if (pin.length < this.PIN_MIN_LENGTH || pin.length > this.PIN_MAX_LENGTH || !/^\d+$/.test(pin)) {
      throw new BadRequestException(`PIN must be ${this.PIN_MIN_LENGTH}-${this.PIN_MAX_LENGTH} digits`);
    }
    const hashed = await argon2.hash(pin, { type: argon2.argon2id });
    const existing = await this.repo.findOne({ where: { userId, tenantId } });
    if (existing) {
      existing.hashedPin = hashed;
      existing.pinSetAt = new Date();
      existing.failedAttempts = 0;
      existing.lockedUntil = null;
      await this.repo.save(existing);
    } else {
      await this.repo.save(this.repo.create({
        tenantId, userId, hashedPin: hashed, pinSetAt: new Date(),
      }));
    }
  }

  async verifyPin(tenantId: string, userId: string, pin: string): Promise<boolean> {
    const record = await this.repo.findOne({ where: { userId, tenantId } });
    if (!record) throw new UnauthorizedException('PIN not configured for user');

    if (record.lockedUntil && new Date() < record.lockedUntil) {
      throw new UnauthorizedException(`PIN locked until ${record.lockedUntil.toISOString()}`);
    }

    const valid = await argon2.verify(record.hashedPin, pin);
    if (!valid) {
      record.failedAttempts += 1;
      if (record.failedAttempts >= this.MAX_ATTEMPTS) {
        record.lockedUntil = new Date(Date.now() + this.LOCKOUT_MINUTES * 60 * 1000);
      }
      await this.repo.save(record);
      throw new UnauthorizedException('Invalid PIN');
    }

    // Reset on success
    if (record.failedAttempts > 0 || record.lockedUntil) {
      record.failedAttempts = 0;
      record.lockedUntil = null;
      await this.repo.save(record);
    }
    return true;
  }
}
