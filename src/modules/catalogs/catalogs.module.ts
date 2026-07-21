import { Module, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CatalogItem } from "../../database/entities/catalog-item.entity";
import { CatalogsService } from "./catalogs.service";
import { CatalogsCacheService } from "./catalogs-cache.service";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CatalogItem])],
  providers: [CatalogsService, CatalogsCacheService],
  exports: [CatalogsService, CatalogsCacheService],
})
export class CatalogsModule {}
