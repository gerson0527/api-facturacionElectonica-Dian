import { DataSource, EntityTarget, ObjectLiteral, Repository } from "typeorm";
import { TenantEntity } from "@/database/entities/base.entity";
import { getTenantContext } from "../context/tenant-context";

export class TenantBaseRepository<
  T extends TenantEntity & ObjectLiteral,
> extends Repository<T> {
  constructor(target: EntityTarget<T>, dataSource: DataSource) {
    super(target, dataSource.createEntityManager());
  }

  private ensureTenantContext(): string {
    const ctx = getTenantContext();
    if (!ctx || ctx.tenantId === "anonymous") {
      throw new Error("Acceso a datos tenant-bound sin contexto de tenant");
    }
    return ctx.tenantId;
  }

  async findAllByTenant(): Promise<T[]> {
    const tenantId = this.ensureTenantContext();
    return this.find({ where: { tenantId } as any });
  }

  async findOneByTenant(id: string): Promise<T | null> {
    const tenantId = this.ensureTenantContext();
    return this.findOne({ where: { id, tenantId } as any });
  }

  async saveWithTenant(entity: T): Promise<T> {
    const tenantId = this.ensureTenantContext();
    (entity as any).tenantId = tenantId;
    return this.save(entity);
  }
}
