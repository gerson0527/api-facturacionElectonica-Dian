import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from './base.entity';

@Entity('user_pins')
@Index('uq_user_pins_user', ['userId'], { unique: true })
export class UserPin extends TenantEntity {
  @Column('uuid', { name: 'user_id' })
  userId: string;

  @Column('varchar', { length: 255, name: 'hashed_pin' })
  hashedPin: string;

  @Column('int', { default: 0, name: 'failed_attempts' })
  failedAttempts: number;

  @Column('timestamptz', { nullable: true, name: 'locked_until' })
  lockedUntil: Date | null;

  @Column('timestamptz', { name: 'pin_set_at' })
  pinSetAt: Date;
}
