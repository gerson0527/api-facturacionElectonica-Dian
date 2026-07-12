import {
  Controller, Post, Param, Body, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { CertificatesService } from './certificates.service';
import { IsString } from 'class-validator';

export class CreateCertificateDto {
  @IsString()
  alias: string;

  @IsString()
  password: string;

  @IsString()
  pin?: string;
}

interface UploadedBufferFile {
  buffer: Buffer;
}

@ApiTags('Certificates')
@Controller('tenants/:tenantId/certificates')
export class CertificatesController {
  constructor(private readonly service: CertificatesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Subir certificado .p12 (AES-256-GCM)' })
  @ApiConsumes('multipart/form-data')
  async upload(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateCertificateDto,
    @UploadedFile() file: UploadedBufferFile,
  ) {
    if (!file) {
      throw new BadRequestException('Archivo .p12 requerido');
    }
    return this.service.upload(tenantId, dto.alias, file.buffer, dto.password, dto.pin);
  }
}
