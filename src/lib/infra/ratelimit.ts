/**
 * Fixed-window rate limiter keyed by client identity (IP).
 *
 * KV is eventually consistent and non-atomic, so this is a soft limit — good
 * enough to stop casual abuse and protect paid upstream quotas. Swap in a
 * Durable Object or the Workers Rate Limiting binding for hard guarantees by
 * implementing `RateLimiter`.
 */

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix seconds when the current window resets. */
  resetAt: number;
  retryAfterSeconds: number;
};

export interface RateLimiter {
  check(identity: string): Promise<RateLimitDecision>;
}

export type RateLimitConfig = { max: number; windowSeconds: number };

function windowFor(now: number, windowSeconds: number) {
  const start = Math.floor(now / 1000 / windowSeconds) * windowSeconds;
  return { start, resetAt: start + windowSeconds };
}

export class MemoryRateLimiter implements RateLimiter {
  private counts = new Map<string, { n: number; resetAt: number }>();
  constructor(private cfg: RateLimitConfig) {}

  async check(identity: string): Promise<RateLimitDecision> {
    const now = Date.now();
    const { start, resetAt } = windowFor(now, this.cfg.windowSeconds);
    const key = `${identity}:${start}`;
    const cur = this.counts.get(key) ?? { n: 0, resetAt };
    cur.n += 1;
    this.counts.set(key, cur);
    // Opportunistic GC
    if (this.counts.size > 5000) {
      for (const [k, v] of this.counts) if (v.resetAt * 1000 < now) this.counts.delete(k);
    }
    const allowed = cur.n <= this.cfg.max;
    return {
      allowed,
      limit: this.cfg.max,
      remaining: Math.max(0, this.cfg.max - cur.n),
      resetAt,
      retryAfterSeconds: allowed ? 0 : Math.max(1, resetAt - Math.floor(now / 1000)),
    };
  }
}

export class KVRateLimiter implements RateLimiter {
  constructor(
    private kv: KVNamespace,
    private cfg: RateLimitConfig,
  ) {}

  async check(identity: string): Promise<RateLimitDecision> {
    const now = Date.now();
    const { start, resetAt } = windowFor(now, this.cfg.windowSeconds);
    const key = `rl:v1:${identity}:${start}`;
    const raw = await this.kv.get(key);
    const n = (raw ? Number.parseInt(raw, 10) || 0 : 0) + 1;
    // Write-behind; a few over-counts under contention are acceptable.
    await this.kv.put(key, String(n), { expirationTtl: Math.max(60, this.cfg.windowSeconds + 5) });
    const allowed = n <= this.cfg.max;
    return {
      allowed,
      limit: this.cfg.max,
      remaining: Math.max(0, this.cfg.max - n),
      resetAt,
      retryAfterSeconds: allowed ? 0 : Math.max(1, resetAt - Math.floor(now / 1000)),
    };
  }
}

const globalForRl = globalThis as unknown as { __dossierMemoryRl?: Map<string, MemoryRateLimiter> };

export function createRateLimiter(cfg: RateLimitConfig, kv?: KVNamespace): RateLimiter {
  if (kv) return new KVRateLimiter(kv, cfg);
  const k = `${cfg.max}:${cfg.windowSeconds}`;
  globalForRl.__dossierMemoryRl ??= new Map();
  let rl = globalForRl.__dossierMemoryRl.get(k);
  if (!rl) {
    rl = new MemoryRateLimiter(cfg);
    globalForRl.__dossierMemoryRl.set(k, rl);
  }
  return rl;
}

/** Best-effort client identity from request headers. */
export function clientIdentity(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anonymous"
  );
}

export function rateLimitHeaders(d: RateLimitDecision): Record<string, string> {
  const h: Record<string, string> = {
    "RateLimit-Limit": String(d.limit),
    "RateLimit-Remaining": String(d.remaining),
    "RateLimit-Reset": String(d.resetAt),
  };
  if (!d.allowed) h["Retry-After"] = String(d.retryAfterSeconds);
  return h;
}
