import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

@Injectable()
export class TenantRlsService {
  private readonly logger = new Logger(TenantRlsService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async setSessionTenant(tenantId: string): Promise<void> {
    try {
      await this.dataSource.query(
        `SELECT set_config('app.tenant_id', $1, false)`,
        [tenantId],
      );
    } catch (err) {
      this.logger.error(
        `Error setting app.tenant_id: ${(err as Error).message}`,
      );
    }
  }

  async clearSessionTenant(): Promise<void> {
    try {
      await this.dataSource.query(
        `SELECT set_config('app.tenant_id', '', false)`,
      );
    } catch (err) {
      this.logger.error(
        `Error clearing app.tenant_id: ${(err as Error).message}`,
      );
    }
  }
}
