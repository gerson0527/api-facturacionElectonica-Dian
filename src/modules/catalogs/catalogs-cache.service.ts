import { Injectable, Logger } from "@nestjs/common";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class CatalogsCacheService {
  private readonly logger = new Logger("CatalogsCache");
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly TTL_MS = 24 * 60 * 60 * 1000;

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}
