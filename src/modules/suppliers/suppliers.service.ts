import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '@/database/entities';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly repo: Repository<Supplier>,
  ) {}

  async findAll(tenantId: string) {
    return this.repo.find({ where: { tenant: { id: tenantId } } });
  }

  async create(tenantId: string, data: any) {
    const supplier = this.repo.create({ ...data, tenant: { id: tenantId } });
    return this.repo.save(supplier);
  }
}
