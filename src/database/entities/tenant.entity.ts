import { Entity, Column, OneToMany } from "typeorm";
import { BaseEntity } from "./base.entity";
import { DianSubmission } from "./dian-submission.entity";
import { WebhookEndpoint } from "./webhook-endpoint.entity";
import type { User } from "./user.entity";
import type { DianSoftwareCredential } from "./dian-software-credential.entity";
import type { DigitalCertificate } from "./digital-certificate.entity";
import type { NumberingRange } from "./numbering-range.entity";
import type { Customer } from "./customer.entity";
import type { Invoice } from "./invoice.entity";

@Entity("tenants")
export class Tenant extends BaseEntity {
  @Column({ type: "varchar", length: 200 })
  name: string;

  @Column({ type: "varchar", length: 20, unique: true })
  nit: string;

  @Column({ type: "varchar", length: 1, default: "0" })
  dv: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  address: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  phone: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  email: string;

  @Column({ type: "boolean", default: true })
  enabled: boolean;

  @Column({ type: "varchar", length: 2, default: "31" })
  documentType: string;

  @Column({ type: "varchar", length: 20, default: "habilitacion" })
  environment: string;

  @OneToMany("User", (u: User) => u.tenant)
  users: User[];

  @OneToMany("DianSoftwareCredential", (s: DianSoftwareCredential) => s.tenant)
  softwareCredentials: DianSoftwareCredential[];

  @OneToMany("DigitalCertificate", (c: DigitalCertificate) => c.tenant)
  digitalCertificates: DigitalCertificate[];

  @OneToMany("NumberingRange", (r: NumberingRange) => r.tenant)
  numberingRanges: NumberingRange[];

  @OneToMany("Customer", (c: Customer) => c.tenant)
  customers: Customer[];

  @OneToMany("Invoice", (i: Invoice) => i.tenant)
  invoices: Invoice[];

  @OneToMany(() => DianSubmission, (ds) => ds.tenant)
  dianSubmissions: DianSubmission[];

  @OneToMany(() => WebhookEndpoint, (we) => we.tenant)
  webhookEndpoints: WebhookEndpoint[];
}
