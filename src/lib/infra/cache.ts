/**
 * Cache abstraction. Production uses Workers KV; dev/tests use an in-process Map.
 * Values are JSON; every entry records when it was written and when it expires
 * so the UI can show freshness honestly.
 */

export type CacheEntry<T> = {
  value: T;
  cachedAt: string;
  expiresAt: string;
};

export interface CacheStore {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class MemoryCache implements CacheStore {
  private store = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (Date.parse(hit.expiresAt) <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return hit as CacheEntry<T>;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const now = Date.now();
    this.store.set(key, {
      value,
      cachedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlSeconds * 1000).toISOString(),
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export class KVCache implements CacheStore {
  constructor(private kv: KVNamespace) {}

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const raw = await this.kv.get<CacheEntry<T>>(key, "json");
    if (!raw) return null;
    if (Date.parse(raw.expiresAt) <= Date.now()) return null;
    return raw;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      cachedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlSeconds * 1000).toISOString(),
    };
    // KV minimum TTL is 60s.
    await this.kv.put(key, JSON.stringify(entry), { expirationTtl: Math.max(60, ttlSeconds) });
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }
}

// Module-level singleton so `next dev` and tests share one in-memory cache per process.
const globalForCache = globalThis as unknown as { __dossierMemoryCache?: MemoryCache };

export function createCache(kv?: KVNamespace): CacheStore {
  if (kv) return new KVCache(kv);
  if (!globalForCache.__dossierMemoryCache) globalForCache.__dossierMemoryCache = new MemoryCache();
  return globalForCache.__dossierMemoryCache;
}

export const CACHE_KEYS = {
  profile: (slug: string) => `profile:v3:${slug}`,
  notFound: (slug: string) => `notfound:v1:${slug}`,
};
