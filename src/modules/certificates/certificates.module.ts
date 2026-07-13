import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CertificatesController } from "./certificates.controller";
import { CertificatesService } from "./certificates.service";
import { DigitalCertificate } from "@/database/entities/digital-certificate.entity";
import { Tenant } from "@/database/entities/tenant.entity";
import { CryptoService } from "@/services/crypto.service";

@Module({
  imports: [TypeOrmModule.forFeature([DigitalCertificate, Tenant])],
  controllers: [CertificatesController],
  providers: [CertificatesService, CryptoService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
