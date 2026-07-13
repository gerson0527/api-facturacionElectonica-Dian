import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Customer } from "@/database/entities/customer.entity";

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async create(
    tenantId: string,
    data: {
      documentType: string;
      documentNumber: string;
      dv?: string;
      name: string;
      address?: string;
      phone?: string;
      email?: string;
      municipalityCode?: string;
      fiscalResponsibilities?: string[];
    },
  ): Promise<Customer> {
    const customer = this.customerRepo.create({
      tenantId,
      ...data,
      fiscalResponsibilities: data.fiscalResponsibilities || ["O-99"],
    });
    return this.customerRepo.save(customer);
  }

  async findByTenant(tenantId: string): Promise<Customer[]> {
    return this.customerRepo.find({
      where: { tenantId },
      order: { name: "ASC" },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Customer> {
    const customer = await this.customerRepo.findOne({
      where: { id, tenantId },
    });
    if (!customer) {
      throw new NotFoundException("Cliente no encontrado");
    }
    return customer;
  }
}
