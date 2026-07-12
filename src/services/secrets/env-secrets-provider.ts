import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretsProvider } from './secrets-provider.interface';

@Injectable()
export class EnvSecretsProvider implements SecretsProvider {
  constructor(private configService: ConfigService) {}

  async get(name: string): Promise<string> {
    const value = this.configService.get<string>(name);
    if (!value) {
      throw new Error(`Secret "${name}" not found in environment`);
    }
    return value;
  }
}
