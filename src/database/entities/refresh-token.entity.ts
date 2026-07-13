import { Entity, Column, Index, PrimaryColumn } from 'typeorm';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  jti: string;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'consumed_at' })
  consumedAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'revoked_at' })
  revokedAt: Date;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'NOW()' })
  createdAt: Date;
}
