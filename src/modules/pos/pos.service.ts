import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { Invoice } from '../../database/entities/invoice.entity';
import { InvoiceLine } from '../../database/entities/invoice-line.entity';
import { Product } from '../../database/entities/product.entity';
import { InventoryMovement, MovementType } from '../../database/entities/inventory-movement.entity';
import { CashMovement } from '../../database/entities/cash-movement.entity';
import { CashService } from '../cash/cash.service';

@Injectable()
export class PosService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private cash: CashService,
  ) {}

  async createSale(dto: CreateSaleDto, tenantId: string, userId: string): Promise<Invoice> {
    return this.dataSource.transaction(async manager => {
      const session = await manager.query(
        `SELECT * FROM cash_sessions WHERE id = $1 AND tenant_id = $2 AND status = 'open' FOR UPDATE`,
        [dto.sessionId, tenantId],
      );
      if (!session || session.length === 0) {
        throw new BadRequestException('Cash session is not open or not found');
      }

      const productIds = [...new Set(dto.lines.map(line => line.productId))];
      const products = await manager
        .createQueryBuilder(Product, 'p')
        .setLock('pessimistic_write')
        .where('p.tenant_id = :tenantId AND p.id IN (:...productIds)', { tenantId, productIds })
        .getMany();
      if (products.length !== productIds.length) {
        throw new NotFoundException('One or more products not found');
      }

      for (const line of dto.lines) {
        const product = products.find(item => item.id === line.productId)!;
        if (Number(product.stock) < line.quantity) {
          throw new ConflictException(`Insufficient stock for product ${product.code}: have ${product.stock}, need ${line.quantity}`);
        }
      }

      let subtotal = 0;
      let totalTax = 0;
      const totals = dto.lines.map(line => {
        const lineSubtotal = line.quantity * line.unitPrice - (line.discount || 0);
        const tax = lineSubtotal * (line.taxRate || 0) / 100;
        subtotal += lineSubtotal;
        totalTax += tax;
        return { lineSubtotal, tax };
      });
      const discount = dto.discount || 0;
      const total = subtotal - discount + totalTax;
      if (total < 0) throw new BadRequestException('Sale total cannot be negative');

      const invoice = manager.create(Invoice, {
        tenantId,
        customerId: dto.customerId,
        status: 'draft',
        paymentMethodCode: dto.paymentMethod,
        issueDate: new Date(),
        customerName: 'Consumidor final',
        customerDocument: '222222222222',
        customerDocumentType: '13',
        subtotal: Number(subtotal.toFixed(2)),
        totalTax: Number(totalTax.toFixed(2)),
        totalAmount: Number(total.toFixed(2)),
        idempotencyKey: dto.idempotencyKey || randomUUID(),
        number: `TEMP-${Date.now()}`,
      });
      await manager.save(invoice);

      for (let index = 0; index < dto.lines.length; index++) {
        const line = dto.lines[index];
        const calculated = totals[index];
        await manager.save(manager.create(InvoiceLine, {
          tenantId,
          invoiceId: invoice.id,
          lineNumber: index + 1,
          description: products.find(product => product.id === line.productId)!.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineExtensionAmount: Number(calculated.lineSubtotal.toFixed(2)),
          taxAmount: Number(calculated.tax.toFixed(2)),
          taxPercent: line.taxRate || 0,
        }));
      }

      for (const line of dto.lines) {
        const product = products.find(item => item.id === line.productId)!;
        const newStock = Number(product.stock) - line.quantity;
        await manager.update(Product, product.id, { stock: newStock });
        await manager.save(manager.create(InventoryMovement, {
          tenantId,
          productId: product.id,
          type: MovementType.OUT,
          quantity: line.quantity,
          reason: 'Venta POS',
          reference: invoice.id,
        }));
      }

      await this.cash.appendMovement(manager, {
        tenantId,
        cashSessionId: dto.sessionId,
        type: 'SALE',
        paymentMethod: dto.paymentMethod,
        amount: total,
        referenceId: invoice.id,
        referenceType: 'invoice',
        userId,
      });
      return invoice;
    });
  }

  async listBySession(tenantId: string, sessionId: string): Promise<Invoice[]> {
    const movements = await this.dataSource.getRepository(CashMovement).find({ where: { tenantId, cashSessionId: sessionId, type: 'SALE' } });
    const ids = movements.map(movement => movement.referenceId).filter((id): id is string => !!id);
    if (ids.length === 0) return [];
    return this.dataSource.getRepository(Invoice).createQueryBuilder('invoice')
      .where('invoice.tenant_id = :tenantId AND invoice.id IN (:...ids)', { tenantId, ids })
      .orderBy('invoice.created_at', 'DESC')
      .getMany();
  }
}
