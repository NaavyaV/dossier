import { AppError } from "@/lib/errors";
import { CACHE_KEYS, createCache } from "@/lib/infra/cache";
import { getRuntimeEnv, intFromEnv } from "@/lib/infra/env";
import { clientIdentity, createRateLimiter, type RateLimitDecision } from "@/lib/infra/ratelimit";
import { parseLinkedInUrl } from "@/lib/linkedin/url";
import { scoreLarp } from "@/lib/larp/score";
import { mergeProfiles, type MergeInput } from "@/lib/merge/merge";
import { buildProviders } from "@/lib/providers/registry";
import type { ProfileProvider, ProviderOutcome } from "@/lib/providers/types";
import { Profile, ProviderProfile, type ProfileEnvelope, type ProviderRun } from "@/lib/schema/profile";

export const DEFAULTS = {
  cacheTtlSeconds: 24 * 60 * 60,
  notFoundTtlSeconds: 60 * 60,
  rateLimitMax: 30,
  rateLimitWindowSeconds: 10 * 60,
  providerTimeoutMs: 9000,
};

export type GetProfileOptions = {
  /** Skip cache read (still writes). */
  refresh?: boolean;
  /** Request headers, used for rate-limit identity. Omit to skip limiting (internal calls). */
  headers?: Headers;
};

export type GetProfileResult = ProfileEnvelope & { rateLimit?: RateLimitDecision };

/**
 * Resolve a LinkedIn URL or slug into a merged Profile.
 * Throws AppError for every failure path.
 */
export async function getProfile(input: string, opts: GetProfileOptions = {}): Promise<GetProfileResult> {
  const parsed = parseLinkedInUrl(input);
  if (!parsed.ok) throw new AppError("INVALID_INPUT", parsed.error.message, { details: { code: parsed.error.code } });
  const { slug, canonicalUrl } = parsed.value;

  const env = getRuntimeEnv();
  const cache = createCache(env.PROFILE_CACHE);
  const ttl = intFromEnv(env.CACHE_TTL_SECONDS, DEFAULTS.cacheTtlSeconds);

  // Rate limit only uncached work; cache hits are cheap and unmetered.
  let rateLimit: RateLimitDecision | undefined;
  const checkRate = async () => {
    if (!opts.headers) return;
    const rl = createRateLimiter(
      { max: intFromEnv(env.RATE_LIMIT_MAX, DEFAULTS.rateLimitMax), windowSeconds: intFromEnv(env.RATE_LIMIT_WINDOW_SECONDS, DEFAULTS.rateLimitWindowSeconds) },
      env.RATE_LIMIT,
    );
    rateLimit = await rl.check(clientIdentity(opts.headers));
    if (!rateLimit.allowed) {
      throw new AppError("RATE_LIMITED", "Too many lookups from your network. Try again shortly.", {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }
  };

  if (!opts.refresh) {
    const hit = await cache.get<ProfileEnvelope["profile"]>(CACHE_KEYS.profile(slug));
    if (hit) {
      const valid = Profile.safeParse(hit.value);
      if (valid.success) {
        return { profile: valid.data, cache: { hit: true, cachedAt: hit.cachedAt, expiresAt: hit.expiresAt, ttlSeconds: ttl } };
      }
      // Schema drift — drop the entry and refetch.
      await cache.delete(CACHE_KEYS.profile(slug));
    }
    const nf = await cache.get<{ note: string }>(CACHE_KEYS.notFound(slug));
    if (nf) {
      throw new AppError("NOT_FOUND", nf.value.note, { details: { slug, cachedAt: nf.cachedAt } });
    }
  }

  await checkRate();

  const providers = buildProviders(env);
  const enabled = providers.filter((p) => p.isEnabled(env));
  const runs: ProviderRun[] = [];

  // Report disabled providers so the UI can be honest about what was consulted.
  for (const p of providers) {
    if (!p.isEnabled(env)) {
      runs.push({ provider: p.id, label: p.label, status: "skipped", durationMs: 0, note: p.disabledReason?.(env) ?? "Disabled", license: p.license });
    }
  }
  if (enabled.filter((p) => p.phase === "primary").length === 0) {
    throw new AppError("NO_PROVIDERS", "No data providers are configured. Set APIFY_TOKEN to look up LinkedIn profiles.");
  }

  const timeoutMs = intFromEnv(env.PROVIDER_TIMEOUT_MS, DEFAULTS.providerTimeoutMs);
  const merged: MergeInput[] = [];

  const runPhase = async (phase: ProfileProvider["phase"], partial: ProviderProfile) => {
    const ps = enabled.filter((p) => p.phase === phase);
    await Promise.all(
      ps.map(async (p) => {
        const started = Date.now();
        const budget = p.timeoutMs ?? timeoutMs;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), budget);
        let outcome: ProviderOutcome;
        try {
          outcome = await p.lookup({ slug, canonicalUrl }, { partial, signal: controller.signal });
        } catch (e) {
          const aborted = controller.signal.aborted;
          outcome = { status: "error", note: aborted ? `Timed out after ${budget}ms.` : sanitize(e) };
        } finally {
          clearTimeout(timer);
        }
        const durationMs = Date.now() - started;

        if (outcome.status === "ok") {
          const valid = ProviderProfile.safeParse(outcome.profile);
          if (!valid.success) {
            runs.push({ provider: p.id, label: p.label, status: "error", durationMs, note: "Provider returned data that failed schema validation.", license: p.license });
            console.warn(`[provider:${p.id}] schema validation failed`, valid.error.issues.slice(0, 3));
            return;
          }
          const fields = Object.entries(valid.data).filter(([, v]) => v !== undefined && (!Array.isArray(v) || v.length)).map(([k]) => k);
          merged.push({ profile: valid.data, meta: outcome.meta });
          runs.push({
            provider: p.id,
            label: outcome.meta.label,
            status: "ok",
            durationMs,
            observedAt: outcome.meta.observedAt,
            sourceUrl: outcome.meta.sourceUrl,
            license: p.license,
            fieldsContributed: fields,
          });
        } else if (outcome.status === "empty") {
          runs.push({ provider: p.id, label: p.label, status: "empty", durationMs, note: outcome.note, license: p.license, observedAt: outcome.meta.observedAt });
        } else {
          runs.push({ provider: p.id, label: p.label, status: outcome.status, durationMs, note: outcome.note, license: p.license });
        }
      }),
    );
  };

  await runPhase("primary", {});
  const synthetic = merged.some((m) => m.meta.synthetic);
  if (merged.length && !synthetic) {
    // Build a lightweight partial for enrichment providers (links are what they key off).
    const partial: ProviderProfile = { links: merged.flatMap((m) => m.profile.links ?? []) };
    await runPhase("enrich", partial);
  } else if (synthetic) {
    for (const p of enabled.filter((x) => x.phase === "enrich")) {
      runs.push({ provider: p.id, label: p.label, status: "skipped", durationMs: 0, note: "Enrichment is not run on sample data.", license: p.license });
    }
  }

  if (!merged.length) {
    const anyError = runs.some((r) => r.status === "error" || r.status === "unavailable");
    const note = anyError
      ? "No source could return this profile right now."
      : "None of the configured sources have a public record for this handle.";
    if (!anyError) await cache.set(CACHE_KEYS.notFound(slug), { note }, DEFAULTS.notFoundTtlSeconds);
    throw new AppError(anyError ? "UPSTREAM_ERROR" : "NOT_FOUND", note, {
      details: { slug, providers: runs.map((r) => ({ provider: r.provider, status: r.status, note: r.note })) },
    });
  }

  const mergedProfile = mergeProfiles(merged, { slug, linkedinUrl: canonicalUrl, runs: sortRuns(runs) });
  const profile = { ...mergedProfile, larp: scoreLarp(mergedProfile) };
  const validated = Profile.parse(profile);
  await cache.set(CACHE_KEYS.profile(slug), validated, ttl);

  const now = Date.now();
  return {
    profile: validated,
    cache: { hit: false, cachedAt: new Date(now).toISOString(), expiresAt: new Date(now + ttl * 1000).toISOString(), ttlSeconds: ttl },
    rateLimit,
  };
}

const ORDER: ProviderRun["status"][] = ["ok", "empty", "unavailable", "error", "skipped"];
function sortRuns(runs: ProviderRun[]) {
  return [...runs].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.label.localeCompare(b.label));
}

/** Never leak keys or stack traces into user-facing notes. */
function sanitize(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/[A-Za-z0-9_\-]{24,}/g, "[redacted]").slice(0, 160) || "Provider failed.";
}
