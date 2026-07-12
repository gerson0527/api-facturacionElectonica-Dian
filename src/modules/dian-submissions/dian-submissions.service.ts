import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DianSubmission } from '@/database/entities/dian-submission.entity';
import { Invoice } from '@/database/entities/invoice.entity';

@Injectable()
export class DianSubmissionsService {
  constructor(
    @InjectRepository(DianSubmission)
    private readonly submissionRepo: Repository<DianSubmission>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async findOne(id: string): Promise<DianSubmission> {
    const submission = await this.submissionRepo.findOne({ where: { id } });
    if (!submission) {
      throw new NotFoundException('Envío no encontrado');
    }
    return submission;
  }

  async findByInvoice(invoiceId: string): Promise<DianSubmission[]> {
    return this.submissionRepo.find({
      where: { invoiceId },
      order: { attemptNumber: 'DESC' },
    });
  }
}
