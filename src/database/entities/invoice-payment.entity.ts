import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TenantEntity } from './base.entity';
import { Invoice } from './invoice.entity';

export type PaymentMethodCode =
  | '10' // Efectivo
  | '11' // Transferencia
  | '12' // Cheque
  | '13' // Transferencia bancaria
  | '20' // Tarjeta crédito
  | '21' // Tarjeta débito
  | '30' // Bonos
  | '41' // Nequi
  | '42' // Daviplata
  | '50' // Canje
  | 'ZZ'; // Otros

@Entity('invoice_payments')
@Index('ix_invoice_payments_invoice', ['invoiceId'])
export class InvoicePayment extends TenantEntity {
  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column('uuid', { name: 'invoice_id' })
  invoiceId: string;

  @Column('varchar', { length: 5, name: 'payment_method_code' })
  paymentMethodCode: PaymentMethodCode;

  @Column('decimal', { precision: 20, scale: 2, name: 'amount' })
  amount: number;

  @Column('varchar', { length: 200, nullable: true, name: 'reference' })
  reference: string;

  @Column('varchar', { length: 200, nullable: true, name: 'received_by' })
  receivedBy: string;

  @Column('varchar', { length: 10, nullable: true, name: 'paid_at' })
  paidAt: string;
}