import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CatalogItem } from "../../database/entities/catalog-item.entity";

@Injectable()
export class CatalogsService {
  private readonly logger = new Logger(CatalogsService.name);
  private cache: Map<string, CatalogItem[]> = new Map();

  constructor(
    @InjectRepository(CatalogItem)
    private readonly catalogRepository: Repository<CatalogItem>,
  ) {}

  async onModuleInit() {
    await this.refreshCache();
  }

  async refreshCache() {
    this.logger.log("Refreshing catalogs cache from database...");
    const items = await this.catalogRepository.find({ where: { isActive: true } });
    
    this.cache.clear();
    for (const item of items) {
      if (!this.cache.has(item.catalogType)) {
        this.cache.set(item.catalogType, []);
      }
      this.cache.get(item.catalogType)!.push(item);
    }
  }

  getItemsByType(catalogType: string): CatalogItem[] {
    return this.cache.get(catalogType) || [];
  }

  getItemByCode(catalogType: string, code: string): CatalogItem | undefined {
    const items = this.getItemsByType(catalogType);
    return items.find((item) => item.code === code);
  }

  getItemName(catalogType: string, code: string, fallback: string = ""): string {
    const item = this.getItemByCode(catalogType, code);
    return item ? item.name : fallback;
  }
}
