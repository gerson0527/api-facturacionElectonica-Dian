import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, Invoice } from '@/database/entities';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>
  ) {}

  async findAll(tenantId: string) {
    const payments = await this.paymentRepo.find({
      where: { tenantId },
      relations: ['invoice', 'invoice.customer'],
      order: { createdAt: 'DESC' }
    });

    return payments.map(p => ({
      id: p.paymentNumber,
      invoiceId: p.invoiceId,
      invoice: p.invoice ? `${p.invoice.prefix}-${p.invoice.number}` : '-',
      customer: p.invoice?.customer?.name || p.invoice?.customerName || '-',
      amount: p.amount,
      date: p.paymentDate,
      method: p.method,
      status: p.status
    }));
  }

  async create(tenantId: string, data: any) {
    // Buscar la factura por su número y prefijo, o asumir que mandan "PREFIJO-NUMERO"
    let invoice;
    if (data.invoiceCode) {
      const parts = data.invoiceCode.split('-');
      if (parts.length >= 2) {
        invoice = await this.invoiceRepo.findOne({
          where: { tenantId, prefix: parts[0], number: parts.slice(1).join('-') }
        });
      }
    }

    if (!invoice) {
      throw new BadRequestException('Factura no encontrada. Asegúrate de usar el formato PREFIJO-NUMERO (ej: SETP-100)');
    }

    const paymentNumber = `REC-${Date.now().toString().slice(-6)}`;

    const payment = this.paymentRepo.create({
      tenantId,
      paymentNumber,
      invoiceId: invoice.id,
      amount: data.amount,
      method: data.method,
      paymentDate: new Date(data.date),
      status: 'Aprobado'
    });

    await this.paymentRepo.save(payment);

    // Optionally update invoice status if fully paid
    // ...

    return payment;
  }
}
