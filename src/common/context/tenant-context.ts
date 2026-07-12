import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextData {
  tenantId: string;
  userId: string;
  role: string;
  requestId: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContextData>();

export function getTenantContext(): TenantContextData | undefined {
  const store = (tenantContext as any).get();
  return store;
}
