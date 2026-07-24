import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { TenantEntity } from './base.entity';
import { CashRegister } from './cash-register.entity';
import { User } from './user.entity';

@Entity('cash_sessions')
@Index('ix_cash_sessions_tenant_status', ['tenantId', 'status'])
export class CashSession extends TenantEntity {
  @ManyToOne(() => CashRegister, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cash_register_id' })
  cashRegister: CashRegister;
  @Column('uuid', { name: 'cash_register_id' })
  cashRegisterId: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('uuid', { name: 'opened_by' })
  openedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'opened_by' })
  openedByUser: User;

  @Column('uuid', { name: 'closed_by', nullable: true })
  closedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'closed_by' })
  closedByUser: User;

  @Column('numeric', { precision: 18, scale: 2, name: 'opening_amount' })
  openingAmount: string;

  @Column('numeric', { precision: 18, scale: 2, nullable: true, name: 'closing_amount' })
  closingAmount: string;

  @Column('numeric', { precision: 18, scale: 2, nullable: true, name: 'expected_amount' })
  expectedAmount: string;

  @Column('numeric', { precision: 18, scale: 2, nullable: true })
  difference: string;

  @Column('varchar', { length: 20, default: 'open' })
  status: 'open' | 'closed' | 'reconciled' | 'voided';

  @Column('timestamptz', { name: 'opened_at' })
  openedAt: Date;

  @Column('timestamptz', { nullable: true, name: 'closed_at' })
  closedAt: Date;

  @Column('text', { nullable: true, name: 'close_notes' })
  closeNotes: string;
}