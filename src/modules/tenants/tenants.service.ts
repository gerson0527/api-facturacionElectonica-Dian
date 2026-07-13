import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { Tenant } from "@/database/entities/tenant.entity";
import { User } from "@/database/entities/user.entity";

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(data: {
    name: string;
    nit: string;
    dv?: string;
    address?: string;
    phone?: string;
    email?: string;
    environment?: string;
    adminEmail: string;
    adminPassword: string;
  }): Promise<Tenant> {
    const existing = await this.tenantRepo.findOne({
      where: { nit: data.nit },
    });
    if (existing) {
      throw new ConflictException("Ya existe un tenant con ese NIT");
    }
    const tenant = this.tenantRepo.create({
      name: data.name,
      nit: data.nit,
      dv: data.dv || "0",
      address: data.address,
      phone: data.phone,
      email: data.email,
      enabled: true,
      environment: data.environment || "habilitacion",
    });
    const saved = await this.tenantRepo.save(tenant);

    // Create admin user
    const adminPassword = await bcrypt.hash(data.adminPassword, 10);
    const admin = this.userRepo.create({
      tenantId: saved.id,
      email: data.adminEmail,
      hashedPassword: adminPassword,
      fullName: `Admin ${saved.name}`,
      role: "tenant_admin",
      isActive: true,
    });
    await this.userRepo.save(admin);

    return saved;
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException("Tenant no encontrado");
    }
    return tenant;
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepo.find({ where: { enabled: true } });
  }
}
