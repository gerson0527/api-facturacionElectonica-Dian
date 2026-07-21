import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class TenantRlsService {
  constructor(private dataSource: DataSource) {}

  async setSessionTenant(tenantId: string): Promise<void> {
    await this.dataSource.query(
      `SELECT set_config('app.tenant_id', $1, false)`,
      [tenantId],
    );
  }

  async setTransactionTenant(manager: EntityManager, tenantId: string): Promise<void> {
    await manager.query(`SET LOCAL app.tenant_id = $1`, [tenantId]);
  }

  async clearSessionTenant(): Promise<void> {
    await this.dataSource.query(`SELECT set_config('app.tenant_id', '', false)`);
  }
}