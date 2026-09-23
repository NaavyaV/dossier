import type { ProviderMeta, ProviderProfile } from "@/lib/schema/profile";
import type { RuntimeEnv } from "@/lib/infra/env";

/**
 * Provider contract. To add a data source: implement this interface, export a
 * factory, and register it in `registry.ts`. Nothing else in the app changes.
 */

export type LookupInput = {
  slug: string;
  canonicalUrl: string;
};

/**
 * Enrichment providers run after primary providers and receive the partial
 * merged view so they can key off discovered identifiers (e.g. a GitHub handle).
 */
export type LookupContext = {
  partial: ProviderProfile;
  signal: AbortSignal;
};

export type ProviderOutcome =
  | { status: "ok"; profile: ProviderProfile; meta: ProviderMeta }
  | { status: "empty"; meta: ProviderMeta; note?: string }
  /** Provider chose not to run (e.g. enrichment with no key to enrich from). */
  | { status: "skipped"; note: string }
  | { status: "unavailable"; note: string }
  | { status: "error"; note: string };

export interface ProfileProvider {
  /** Stable machine id, used in provenance and cache. */
  readonly id: string;
  /** Human label for the UI. */
  readonly label: string;
  /** Primary providers resolve a slug; enrichment providers extend a partial profile. */
  readonly phase: "primary" | "enrich";
  /** 0..1 prior confidence in data from this source. */
  readonly baseConfidence: number;
  /** License / origin statement shown to users. */
  readonly license: string;
  /** Whether this provider is configured to run in the current environment. */
  isEnabled(env: RuntimeEnv): boolean;
  /** Short reason for `isEnabled() === false`, shown in the provider table. */
  disabledReason?(env: RuntimeEnv): string;
  lookup(input: LookupInput, ctx: LookupContext): Promise<ProviderOutcome>;
}

export type ProviderFactory = (env: RuntimeEnv) => ProfileProvider;
