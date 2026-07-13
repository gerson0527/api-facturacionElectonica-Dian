import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Invoice } from "@/database/entities";

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async findExisting(key: string): Promise<Invoice | null> {
    return this.invoiceRepo.findOne({ where: { idempotencyKey: key } });
  }

  async exists(key: string): Promise<boolean> {
    const count = await this.invoiceRepo.count({
      where: { idempotencyKey: key },
    });
    return count > 0;
  }
}
