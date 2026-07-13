import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantEntity } from './base.entity';
import { Tenant } from './tenant.entity';

@Entity('users')
export class User extends TenantEntity {
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, name: 'hashed_password' })
  hashedPassword: string;

  @Column({ type: 'varchar', length: 200, name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', length: 50, default: 'tenant_user' })
  role: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'int', default: 0, name: 'failed_attempts' })
  failedAttempts: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'locked_until' })
  lockedUntil: Date | null;

  @ManyToOne(() => Tenant, (t) => t.users)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
