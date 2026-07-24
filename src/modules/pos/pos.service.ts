import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { Invoice } from '../../database/entities/invoice.entity';
import { InvoiceLine } from '../../database/entities/invoice-line.entity';
import { Product } from '../../database/entities/product.entity';
import { InventoryMovement, MovementType } from '../../database/entities/inventory-movement.entity';
import { CashMovement } from '../../database/entities/cash-movement.entity';
import { InvoicePayment } from '../../database/entities/invoice-payment.entity';
import { CashService } from '../cash/cash.service';

import { NumberingRangesService } from '../numbering-ranges/numbering-ranges.service';

@Injectable()
export class PosService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private cash: CashService,
    private numberingRangesService: NumberingRangesService,
  ) {}

  async createSale(dto: CreateSaleDto, tenantId: string, userId: string): Promise<Invoice> {
    try {
      return await this.dataSource.transaction(async manager => {
        const session = await manager.query(
          `SELECT * FROM cash_sessions WHERE id = $1 AND tenant_id = $2 AND status = 'open' FOR UPDATE`,
          [dto.sessionId, tenantId],
        );
        if (!session || session.length === 0) {
          throw new BadRequestException('La sesión de caja no está abierta o no fue encontrada.');
        }

        const productIds = [...new Set(dto.lines.map(line => line.productId))];
        let products: Product[] = [];
        if (productIds.length > 0) {
          products = await manager
            .createQueryBuilder(Product, 'p')
            .setLock('pessimistic_write')
            .where('p.tenant_id = :tenantId AND p.id IN (:...productIds)', { tenantId, productIds })
            .getMany();
        }

        for (const line of dto.lines) {
          const product = products.find(item => item.id === line.productId);
          if (product && Number(product.stock) < line.quantity) {
            throw new ConflictException(
              `Stock insuficiente para el producto ${product.code || product.name}: disponible ${product.stock}, solicitado ${line.quantity}`,
            );
          }
        }

        let subtotal = 0;
        let totalTax = 0;
        const totals = dto.lines.map(line => {
          // Round each line + tax to the nearest peso to match how the UI displays totals
          const lineSubtotal = Math.round(
            (line.quantity * line.unitPrice - (line.discount || 0)) * 100,
          ) / 100;
          const tax = Math.round(lineSubtotal * (line.taxRate || 0)) / 100;
          subtotal += lineSubtotal;
          totalTax += tax;
          return { lineSubtotal, tax };
        });
        const discount = dto.discount || 0;
        // Total rounded to the nearest peso (COP). UI does the same.
        const total = Math.round(subtotal - discount + totalTax);
        if (total < 0) throw new BadRequestException('El total de la venta no puede ser negativo.');

        // Validate that sum of payments equals total (tolerance 1 peso for rounding)
        const paymentsTotal = Math.round(
          dto.payments.reduce((s, p) => s + Number(p.amount), 0),
        );
        if (Math.abs(paymentsTotal - total) > 1) {
          throw new BadRequestException(
            `La suma de pagos (${paymentsTotal.toFixed(2)}) no coincide con el total de la factura (${total.toFixed(2)})`,
          );
        }

        const { number: reservedNumber } = await this.numberingRangesService.reserveNextNumber(
          tenantId,
          'POS',
          manager,
        );

        const activeRegisterId =
          session[0]?.cash_register_id || session[0]?.cashRegisterId;

        const validIdempotencyKey =
          dto.idempotencyKey && dto.idempotencyKey.length === 36 && dto.idempotencyKey.includes('-')
            ? dto.idempotencyKey
            : randomUUID();

        // Pick the first payment as the "primary" for Invoice.paymentMethodCode (legacy field)
        const primaryPayment = dto.payments[0];

        const invoice = manager.create(Invoice, {
          tenantId,
          prefix: 'POS',
          customerId:
            dto.customerId && dto.customerId.length === 36 && dto.customerId.includes('-')
              ? dto.customerId
              : undefined,
          cashSessionId: dto.sessionId,
          cashRegisterId: activeRegisterId,
          status: 'draft',
          paymentMethodCode: primaryPayment.paymentMethodCode,
          paymentFormCode: dto.paymentFormCode || '1',
          issueDate: new Date(),
          customerName: 'Consumidor final',
          customerDocument: '222222222222',
          customerDocumentType: '13',
          subtotal: Number(subtotal.toFixed(2)),
          totalTax: Number(totalTax.toFixed(2)),
          totalAmount: Number(total.toFixed(2)),
          idempotencyKey: validIdempotencyKey,
          number: reservedNumber,
        });
        await manager.save(invoice);

        // Persist each payment (supports split / mixed payments)
        for (const payment of dto.payments) {
          const paymentEntity = manager.create(InvoicePayment);
          paymentEntity.tenantId = tenantId;
          paymentEntity.invoiceId = invoice.id;
          paymentEntity.paymentMethodCode = payment.paymentMethodCode as any;
          paymentEntity.amount = Number(payment.amount);
          paymentEntity.reference = payment.reference || '';
          await manager.save(paymentEntity);
        }

        for (let index = 0; index < dto.lines.length; index++) {
          const line = dto.lines[index];
          const calculated = totals[index];
          const prod = products.find(product => product.id === line.productId);
          await manager.save(
            manager.create(InvoiceLine, {
              tenantId,
              invoiceId: invoice.id,
              lineNumber: index + 1,
              description: prod ? prod.name : `Producto ${line.productId}`,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineExtensionAmount: Number(calculated.lineSubtotal.toFixed(2)),
              taxAmount: Number(calculated.tax.toFixed(2)),
              taxPercent: line.taxRate || 0,
            }),
          );
        }

        for (const line of dto.lines) {
          const product = products.find(item => item.id === line.productId);
          if (product) {
            const newStock = Number(product.stock || 0) - line.quantity;
            await manager.update(Product, product.id, { stock: newStock });
            await manager.save(
              manager.create(InventoryMovement, {
                tenantId,
                productId: product.id,
                type: MovementType.OUT,
                quantity: line.quantity,
                reason: 'Venta POS',
                reference: invoice.id,
              }),
            );
          }
        }

        const validUserId =
          userId && userId.length === 36 && userId.includes('-')
            ? userId
            : session[0]?.opened_by || session[0]?.openedBy || '00000000-0000-0000-0000-000000000000';

        // Persist a CashMovement per payment so the cash session reflects each method
        for (const payment of dto.payments) {
          await this.cash.appendMovement(manager, {
            tenantId,
            cashSessionId: dto.sessionId,
            type: 'SALE',
            paymentMethod: payment.paymentMethodCode,
            amount: Number(payment.amount),
            referenceId: invoice.id,
            referenceType: 'invoice',
            userId: validUserId,
          });
        }

        return invoice;
      });
    } catch (e: any) {
      if (
        e instanceof BadRequestException ||
        e instanceof ConflictException ||
        e instanceof NotFoundException
      ) {
        throw e;
      }
      throw new BadRequestException(`Error al procesar la venta POS: ${e.message}`);
    }
  }

  async listBySession(tenantId: string, sessionId: string): Promise<Invoice[]> {
    const movements = await this.dataSource
      .getRepository(CashMovement)
      .find({ where: { tenantId, cashSessionId: sessionId, type: 'SALE' } });
    const ids = movements.map(movement => movement.referenceId).filter((id): id is string => !!id);
    if (ids.length === 0) return [];
    return this.dataSource
      .getRepository(Invoice)
      .createQueryBuilder('invoice')
      .where('invoice.tenant_id = :tenantId AND invoice.id IN (:...ids)', { tenantId, ids })
      .orderBy('invoice.created_at', 'DESC')
      .getMany();
  }
}