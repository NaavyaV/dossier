import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Runtime environment access that works in three places:
 *  - `next dev` (OpenNext dev shim provides Cloudflare bindings via miniflare)
 *  - Cloudflare Workers (real bindings)
 *  - plain Node (tests) — bindings are undefined, secrets from process.env
 */

export type RateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type Bindings = {
  PROFILE_CACHE?: KVNamespace;
  PROFILE_RATE_LIMIT?: RateLimitBinding;
};

export type Secrets = {
  APIFY_TOKEN?: string;
  /** `username~actor-name`. Defaults to harvestapi~linkedin-profile-scraper. */
  APIFY_LINKEDIN_ACTOR?: string;
  APIFY_TIMEOUT_MS?: string;
  GITHUB_TOKEN?: string;
  ENABLE_DEMO_PROVIDER?: string;
  CACHE_TTL_SECONDS?: string;
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_WINDOW_SECONDS?: string;
  PROVIDER_TIMEOUT_MS?: string;
};

export type RuntimeEnv = Bindings & Secrets;

let warned = false;

export function getRuntimeEnv(): RuntimeEnv {
  let cf: Record<string, unknown> = {};
  try {
    cf = getCloudflareContext().env as unknown as Record<string, unknown>;
  } catch {
    if (!warned && process.env.NODE_ENV !== "test") {
      warned = true;
      console.warn("[env] Cloudflare context unavailable; using process.env only (no KV).");
    }
  }
  // Secrets/vars: prefer the Cloudflare env, fall back to process.env (local .env).
  const pick = (k: keyof Secrets): string | undefined => {
    const v = cf[k];
    if (typeof v === "string" && v.length > 0) return v;
    const p = process.env[k];
    return p && p.length > 0 ? p : undefined;
  };

  return {
    PROFILE_CACHE: cf.PROFILE_CACHE as KVNamespace | undefined,
    PROFILE_RATE_LIMIT: cf.PROFILE_RATE_LIMIT as RateLimitBinding | undefined,
    APIFY_TOKEN: pick("APIFY_TOKEN"),
    APIFY_LINKEDIN_ACTOR: pick("APIFY_LINKEDIN_ACTOR"),
    APIFY_TIMEOUT_MS: pick("APIFY_TIMEOUT_MS"),
    GITHUB_TOKEN: pick("GITHUB_TOKEN"),
    ENABLE_DEMO_PROVIDER: pick("ENABLE_DEMO_PROVIDER"),
    CACHE_TTL_SECONDS: pick("CACHE_TTL_SECONDS"),
    RATE_LIMIT_MAX: pick("RATE_LIMIT_MAX"),
    RATE_LIMIT_WINDOW_SECONDS: pick("RATE_LIMIT_WINDOW_SECONDS"),
    PROVIDER_TIMEOUT_MS: pick("PROVIDER_TIMEOUT_MS"),
  };
}

export function intFromEnv(v: string | undefined, fallback: number): number {
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function boolFromEnv(v: string | undefined, fallback = false): boolean {
  if (v === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}
