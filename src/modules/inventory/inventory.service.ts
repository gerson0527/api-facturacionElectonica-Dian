import { Injectable, BadRequestException } from '@nestjs/common';
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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find product to check and update stock
      const product = await queryRunner.manager.findOne(Product, { 
        where: { id: data.productId, tenant: { id: tenantId } }
      });

      if (!product) throw new BadRequestException('Product not found');

      const qty = Number(data.quantity);
      if (data.type === MovementType.OUT && product.stock < qty) {
        throw new BadRequestException('Insufficient stock');
      }

      // Update product stock
      if (data.type === MovementType.IN) {
        product.stock += qty;
      } else {
        product.stock -= qty;
      }
      await queryRunner.manager.save(Product, product);

      // Create movement record
      const movement = queryRunner.manager.create(InventoryMovement, {
        type: data.type,
        quantity: qty,
        reason: data.reason,
        reference: data.reference,
        product: { id: product.id },
        tenant: { id: tenantId }
      });
      await queryRunner.manager.save(InventoryMovement, movement);

      await queryRunner.commitTransaction();
      return movement;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
