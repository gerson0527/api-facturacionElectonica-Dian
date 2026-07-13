import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SoftwareCredentialsController } from "./software-credentials.controller";
import { SoftwareCredentialsService } from "./software-credentials.service";
import { DianSoftwareCredential } from "@/database/entities/dian-software-credential.entity";
import { Tenant } from "@/database/entities/tenant.entity";
import { CryptoService } from "@/services/crypto.service";

@Module({
  imports: [TypeOrmModule.forFeature([DianSoftwareCredential, Tenant])],
  controllers: [SoftwareCredentialsController],
  providers: [SoftwareCredentialsService, CryptoService],
  exports: [SoftwareCredentialsService],
})
export class SoftwareCredentialsModule {}
