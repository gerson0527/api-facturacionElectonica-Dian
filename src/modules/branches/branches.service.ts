import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Branch } from "../../database/entities/branch.entity";
import { Warehouse } from "../../database/entities/warehouse.entity";

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch) private branchRepo: Repository<Branch>,
    @InjectRepository(Warehouse) private warehouseRepo: Repository<Warehouse>,
  ) {}

  async listBranches(tenantId: string): Promise<Branch[]> {
    return this.branchRepo.find({ where: { tenantId, isActive: true }, order: { name: "ASC" } });
  }

  async createBranch(tenantId: string, data: Partial<Branch>): Promise<Branch> {
    const branch = this.branchRepo.create({ ...data, tenantId });
    return this.branchRepo.save(branch);
  }

  async listWarehouses(tenantId: string, branchId?: string): Promise<Warehouse[]> {
    const where: any = { tenantId, isActive: true };
    if (branchId) where.branchId = branchId;
    return this.warehouseRepo.find({ where, order: { name: "ASC" } });
  }

  async createWarehouse(tenantId: string, data: Partial<Warehouse>): Promise<Warehouse> {
    const wh = this.warehouseRepo.create({ ...data, tenantId });
    return this.warehouseRepo.save(wh);
  }
}
