import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantEntity } from './base.entity';
import { Tenant } from './tenant.entity';

@Entity('numbering_ranges')
export class NumberingRange extends TenantEntity {
  @Column({ type: 'varchar', length: 10 })
  prefix: string;

  @Column({ type: 'int', name: 'from_number' })
  fromNumber: number;

  @Column({ type: 'int', name: 'to_number' })
  toNumber: number;

  @Column({ type: 'int', name: 'current_number', default: 0 })
  currentNumber: number;

  @Column({ type: 'varchar', length: 100, name: 'resolution_number' })
  resolutionNumber: string;

  @Column({ type: 'date', name: 'resolution_date' })
  resolutionDate: Date;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @ManyToOne(() => Tenant, (t) => t.numberingRanges)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
