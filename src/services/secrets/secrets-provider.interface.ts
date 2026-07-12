export interface SecretsProvider {
  get(name: string): Promise<string>;
  getVersion?(name: string): Promise<string>;
}

export const SECRETS_PROVIDER_TOKEN = 'SECRETS_PROVIDER';
