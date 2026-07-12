import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent, RemoveEvent } from 'typeorm';
import { TenantEntity } from '@/database/entities/base.entity';

@Injectable()
export class AuditSubscriber implements EntitySubscriberInterface {
  constructor(@InjectDataSource() readonly dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  afterInsert(event: InsertEvent<any>): void {
    if (event.entity?.tenantId) {
      // Audit logging handled by AuditInterceptor
    }
  }

  afterUpdate(event: UpdateEvent<any>): void {
    if (event.entity?.tenantId) {
      // Audit logging handled by AuditInterceptor
    }
  }

  afterRemove(event: RemoveEvent<any>): void {
    if (event.entity?.tenantId) {
      // Audit logging handled by AuditInterceptor
    }
  }
}
