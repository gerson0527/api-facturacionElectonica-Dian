import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile, writeFile, mkdir, unlink, access } from 'fs/promises';
import { join, dirname } from 'path';

export type DocumentType = 'xml' | 'signed-xml' | 'pdf' | 'dian-response';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly basePath: string;

  constructor(private configService: ConfigService) {
    this.basePath = this.configService.get<string>('STORAGE_PATH') || join(process.cwd(), 'storage');
  }

  private getPath(tenantId: string, docType: DocumentType, fileName: string): string {
    return join(this.basePath, docType, tenantId, fileName);
  }

  async save(tenantId: string, docType: DocumentType, fileName: string, content: Buffer | string): Promise<string> {
    const filePath = this.getPath(tenantId, docType, fileName);
    await mkdir(dirname(filePath), { recursive: true });
    const data = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    await writeFile(filePath, data);
    this.logger.debug(`Archivo guardado: ${filePath}`);
    return filePath;
  }

  async read(tenantId: string, docType: DocumentType, fileName: string): Promise<Buffer> {
    const filePath = this.getPath(tenantId, docType, fileName);
    return readFile(filePath);
  }

  async exists(tenantId: string, docType: DocumentType, fileName: string): Promise<boolean> {
    try {
      const filePath = this.getPath(tenantId, docType, fileName);
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(tenantId: string, docType: DocumentType, fileName: string): Promise<void> {
    const filePath = this.getPath(tenantId, docType, fileName);
    await unlink(filePath);
    this.logger.debug(`Archivo eliminado: ${filePath}`);
  }

  getFullPath(tenantId: string, docType: DocumentType, fileName: string): string {
    return this.getPath(tenantId, docType, fileName);
  }
}
