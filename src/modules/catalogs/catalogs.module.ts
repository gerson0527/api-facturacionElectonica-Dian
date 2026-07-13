import { Module, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CatalogItem } from "../../database/entities/catalog-item.entity";
import { CatalogsService } from "./catalogs.service";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CatalogItem])],
  providers: [CatalogsService],
  exports: [CatalogsService],
})
export class CatalogsModule {}
