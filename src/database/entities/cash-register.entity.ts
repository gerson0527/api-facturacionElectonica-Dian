import { Entity, Column, Index } from 'typeorm';
import { TenantEntity } from './base.entity';

@Entity('cash_registers')
export class CashRegister extends TenantEntity {
  @Column('varchar', { length: 200 })
  name: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('varchar', { length: 200, nullable: true })
  location: string;

  @Column('boolean', { default: true })
  active: boolean;

  @Column('numeric', { precision: 18, scale: 2, default: 0, name: 'opening_balance_default' })
  openingBalanceDefault: string;
}