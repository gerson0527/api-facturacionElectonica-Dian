import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '@/database/entities';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
  ) {}

  async findAll(tenantId: string) {
    return this.repo.find({ where: { tenant: { id: tenantId } } });
  }

  async create(tenantId: string, data: any) {
    const product = this.repo.create({ ...data, tenant: { id: tenantId } });
    return this.repo.save(product);
  }
}
