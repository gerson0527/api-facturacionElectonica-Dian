import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent } from '@/database/entities/audit-event.entity';

export interface AuditLogInput {
  tenantId: string;
  actor: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditRepo: Repository<AuditEvent>,
  ) {}

  async log(input: AuditLogInput): Promise<AuditEvent> {
    try {
      const event = this.auditRepo.create({
        tenantId: input.tenantId,
        actor: input.actor,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        details: input.details || {},
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
      return await this.auditRepo.save(event);
    } catch (err) {
      this.logger.error(`Error registrando auditoría: ${(err as Error).message}`);
      throw err;
    }
  }

  async findByTenant(
    tenantId: string,
    options: { limit?: number; offset?: number; entityType?: string; actor?: string } = {},
  ): Promise<[AuditEvent[], number]> {
    const query = this.auditRepo.createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .orderBy('a.createdAt', 'DESC');

    if (options.entityType) {
      query.andWhere('a.entityType = :entityType', { entityType: options.entityType });
    }
    if (options.actor) {
      query.andWhere('a.actor = :actor', { actor: options.actor });
    }

    query.skip(options.offset || 0).take(options.limit || 50);
    return query.getManyAndCount();
  }
}
