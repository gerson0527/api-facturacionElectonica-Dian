import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantEntity } from './base.entity';
import { Tenant } from './tenant.entity';

@Entity('customers')
export class Customer extends TenantEntity {
  @Column({ type: 'varchar', length: 5, name: 'document_type' })
  documentType: string;

  @Column({ type: 'varchar', length: 30, name: 'document_number' })
  documentNumber: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  dv: string;

  @Column({ type: 'varchar', length: 300 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'municipality_code' })
  municipalityCode: string;

  @Column({ type: 'jsonb', nullable: true, name: 'fiscal_responsibilities' })
  fiscalResponsibilities: string[];

  @ManyToOne(() => Tenant, (t) => t.customers)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
