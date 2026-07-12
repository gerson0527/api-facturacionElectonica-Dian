import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('audit_events')
@Index(['tenantId', 'entityType', 'createdAt'])
export class AuditEvent extends BaseEntity {
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'varchar', length: 100 })
  actor: string;

  @Column({ type: 'varchar', length: 255 })
  action: string;

  @Column({ type: 'varchar', length: 100, name: 'entity_type' })
  entityType: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'entity_id' })
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any>;

  @Column({ type: 'varchar', length: 50, name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent: string;
}
