import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from './base.entity';

@Entity('cash_movements')
@Index('ix_cash_movements_session', ['tenantId', 'cashSessionId', 'createdAt'])
export class CashMovement extends TenantEntity {
  @Column('uuid', { name: 'cash_session_id' })
  cashSessionId: string;

  @Column('varchar', { length: 30 })
  type: 'SALE' | 'INCOME' | 'EXPENSE' | 'REFUND' | 'WITHDRAWAL';

  @Column('varchar', { length: 30, name: 'payment_method' })
  paymentMethod: string;

  @Column('numeric', { precision: 18, scale: 2 })
  amount: string;

  @Column('uuid', { name: 'reference_id', nullable: true })
  referenceId: string;

  @Column('varchar', { length: 30, name: 'reference_type', nullable: true })
  referenceType: string;

  @Column('uuid', { name: 'user_id' })
  userId: string;

  @Column('text', { nullable: true })
  notes: string;
}