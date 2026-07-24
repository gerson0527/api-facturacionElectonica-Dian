import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class TenantRlsService {
  constructor(private dataSource: DataSource) {}

  async setSessionTenant(tenantId: string): Promise<void> {
    const validTenantId = (tenantId && tenantId.length === 36 && tenantId.includes('-'))
      ? tenantId
      : '00000000-0000-0000-0000-000000000000';
    await this.dataSource.query(
      `SELECT set_config('app.tenant_id', $1, false)`,
      [validTenantId],
    ).catch(() => {});
  }

  async setTransactionTenant(manager: EntityManager, tenantId: string): Promise<void> {
    const validTenantId = (tenantId && tenantId.length === 36 && tenantId.includes('-'))
      ? tenantId
      : '00000000-0000-0000-0000-000000000000';
    await manager.query(`SET LOCAL app.tenant_id = $1`, [validTenantId]).catch(() => {});
  }

  async clearSessionTenant(): Promise<void> {
    await this.dataSource.query(`SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000000000', false)`).catch(() => {});
  }
}