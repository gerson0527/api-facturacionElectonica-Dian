import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InventoryMovement, MovementType, Product } from '@/database/entities';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryMovement)
    private readonly repo: Repository<InventoryMovement>,
    private readonly dataSource: DataSource
  ) {}

  async findAll(tenantId: string) {
    return this.repo.find({
      where: { tenant: { id: tenantId } },
      relations: ['product'],
      order: { createdAt: 'DESC' }
    });
  }

  async createMovement(tenantId: string, data: any) {
    return this.dataSource.transaction(async manager => {
      const product = await manager.findOne(Product, {
        where: { id: data.productId, tenant: { id: tenantId } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException('Product not found');

      const qty = Number(data.quantity);
      if (data.type === MovementType.OUT && Number(product.stock) < qty) {
        throw new ConflictException('Insufficient stock');
      }

      const newStock = data.type === MovementType.IN
        ? Number(product.stock) + qty
        : Number(product.stock) - qty;

      await manager.update(Product, product.id, { stock: newStock });

      const movement = manager.create(InventoryMovement, {
        type: data.type,
        quantity: qty,
        reason: data.reason,
        reference: data.reference,
        product: { id: product.id },
        tenant: { id: tenantId }
      });
      return manager.save(InventoryMovement, movement);
    });
  }
}
