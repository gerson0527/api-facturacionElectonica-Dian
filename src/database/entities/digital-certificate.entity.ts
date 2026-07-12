import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantEntity } from './base.entity';
import { Tenant } from './tenant.entity';

@Entity('digital_certificates')
export class DigitalCertificate extends TenantEntity {
  @Column({ type: 'varchar', length: 200 })
  alias: string;

  @Column({ type: 'text', name: 'encrypted_pfx_path' })
  encryptedPfxPath: string;

  @Column({ type: 'text', name: 'encrypted_password_ref' })
  encryptedPasswordRef: string;

  @Column({ type: 'text', name: 'encrypted_pin_ref', nullable: true })
  encryptedPinRef: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @ManyToOne(() => Tenant, (t) => t.digitalCertificates)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
