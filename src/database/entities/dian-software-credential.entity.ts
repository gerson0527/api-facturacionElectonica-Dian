import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantEntity } from './base.entity';
import { Tenant } from './tenant.entity';

@Entity('dian_software_credentials')
export class DianSoftwareCredential extends TenantEntity {
  @Column({ type: 'varchar', length: 100, name: 'software_id' })
  softwareId: string;

  @Column({ type: 'text', name: 'software_pin_encrypted' })
  softwarePinEncrypted: string;

  @Column({ type: 'varchar', length: 100, name: 'test_set_id', nullable: true })
  testSetId: string;

  @Column({ type: 'varchar', length: 50, default: 'pending', name: 'habilitacion_status' })
  habilitacionStatus: string;

  @ManyToOne(() => Tenant, (t) => t.softwareCredentials)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
