import type { RuntimeEnv } from "@/lib/infra/env";
import type { ProfileProvider } from "./types";
import { createApifyProvider } from "./apify";
import { createWikidataProvider } from "./wikidata";
import { createGitHubProvider } from "./github";
import { createDemoProviders } from "./demo";

/**
 * LinkedIn profile text comes from Apify. Wikidata and GitHub only add
 * openly licensed corroboration. Order is the tie-break when confidence is equal.
 */
export function buildProviders(env: RuntimeEnv): ProfileProvider[] {
  return [
    createApifyProvider(env),
    createWikidataProvider(env),
    ...createDemoProviders(env),
    createGitHubProvider(env),
  ];
}

export type { ProfileProvider } from "./types";
