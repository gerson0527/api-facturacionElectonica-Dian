import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quotation, QuotationStatus } from '@/database/entities/quotation.entity';
import { QuotationLine } from '@/database/entities/quotation-line.entity';
import { Customer } from '@/database/entities/customer.entity';

@Injectable()
export class QuotationsService {
  constructor(
    @InjectRepository(Quotation)
    private readonly repo: Repository<Quotation>,
    @InjectRepository(QuotationLine)
    private readonly lineRepo: Repository<QuotationLine>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async create(tenantId: string, data: any) {
    const customer = await this.customerRepo.findOne({ where: { id: data.customerId, tenantId } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    const number = `COT-${Date.now()}`;

    const quotation = this.repo.create({
      tenantId,
      number,
      issueDate: new Date(data.issueDate),
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      customerId: data.customerId,
      subtotal: data.subtotal,
      totalTax: data.totalTax,
      totalAmount: data.totalAmount,
      notes: data.notes,
      status: QuotationStatus.DRAFT,
    });

    const saved = await this.repo.save(quotation);

    if (data.lines && data.lines.length > 0) {
      const lines = data.lines.map((l: any, i: number) => this.lineRepo.create({
        tenantId,
        quotationId: saved.id,
        lineNumber: i + 1,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxPercent: l.taxPercent || 0,
        taxAmount: l.taxAmount || 0,
        lineExtensionAmount: l.lineExtensionAmount,
      }));
      await this.lineRepo.save(lines);
    }

    return this.findOne(tenantId, saved.id);
  }

  async findAll(tenantId: string) {
    return this.repo.find({
      where: { tenantId },
      relations: ['customer'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const quotation = await this.repo.findOne({
      where: { id, tenantId },
      relations: ['customer', 'lines'],
    });
    if (!quotation) throw new NotFoundException('Cotización no encontrada');
    return quotation;
  }

  async updateStatus(tenantId: string, id: string, status: QuotationStatus) {
    const quotation = await this.findOne(tenantId, id);
    quotation.status = status;
    return this.repo.save(quotation);
  }
}
