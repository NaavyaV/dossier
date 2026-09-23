import type { RuntimeEnv } from "@/lib/infra/env";
import type { ProfileProvider } from "./types";
import { createPdlProvider } from "./pdl";
import { createRapidApiProvider } from "./rapidapi";
import { createWikidataProvider } from "./wikidata";
import { createGitHubProvider } from "./github";
import { createPublicPageProvider } from "./public-page";
import { createDemoProviders } from "./demo";

/**
 * Provider registry. Order matters only for tie-breaking in the merger
 * (earlier = preferred when confidence is equal). Add or remove sources here.
 */
export function buildProviders(env: RuntimeEnv): ProfileProvider[] {
  return [
    createPdlProvider(env),
    createRapidApiProvider(env),
    createWikidataProvider(env),
    createPublicPageProvider(env),
    ...createDemoProviders(env),
    // Enrichment (runs second, keyed off primary results)
    createGitHubProvider(env),
  ];
}

export type { ProfileProvider } from "./types";
