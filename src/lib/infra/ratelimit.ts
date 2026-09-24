import type { RateLimitBinding } from "@/lib/infra/env";

/**
 * Rate limiter keyed by client IP.
 * Production uses the Workers Rate Limiting binding, which does not write KV.
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

export class BindingRateLimiter implements RateLimiter {
  constructor(
    private binding: RateLimitBinding,
    private cfg: RateLimitConfig,
  ) {}

  async check(identity: string): Promise<RateLimitDecision> {
    const { success } = await this.binding.limit({ key: identity });
    const now = Math.floor(Date.now() / 1000);
    return {
      allowed: success,
      limit: this.cfg.max,
      remaining: success ? this.cfg.max : 0,
      resetAt: now + this.cfg.windowSeconds,
      retryAfterSeconds: success ? 0 : this.cfg.windowSeconds,
    };
  }
}

const globalForRl = globalThis as unknown as { __dossierMemoryRl?: Map<string, MemoryRateLimiter> };

export function createRateLimiter(cfg: RateLimitConfig, binding?: RateLimitBinding): RateLimiter {
  if (binding) return new BindingRateLimiter(binding, cfg);
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
