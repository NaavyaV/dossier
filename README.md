# LARP detector

is it real or is it larp?

Paste a public LinkedIn profile URL → a structured, **sourced** professional profile and a **0–100% LARP score**. The score is an arbitrary heuristic over the public text (buzzwords, theater titles, stacked roles, versus specifics and tenure). It is not a lie detector.

The product was originally named Dossier; the Worker and repo keep that name so the live URL stays put.

Every field carries the provider it came from, when that provider observed it, and a confidence score. LinkedIn profile text is fetched through [Apify](https://apify.com/harvestapi/linkedin-profile-scraper) with your account token. Wikidata and GitHub add open data on top. Emails and phone numbers are never collected.

**Live:** https://dossier.devpost67.workers.dev · **Sample:** [/profile/demo](https://dossier.devpost67.workers.dev/profile/demo) · **API:** `GET /api/profile?url=<linkedin url>`

## Stack

- **Next.js 16** (App Router, React Server Components) + **TypeScript** + **Tailwind v4**
- Deployed to **Cloudflare Workers** via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)
- **Workers KV** for the profile cache and rate-limit counters
- **Zod** for input, provider-output and final-profile validation
- **Vitest** for unit tests

## How a dossier is assembled

```
URL ──▶ parse/validate ──▶ cache? ──▶ rate limit ──▶ providers (parallel, timeout)
                                                          │
                       primary: Apify (LinkedIn) · Wikidata · demo

                       enrich:  GitHub (keyed off links discovered above)
                                                          ▼
                                 normalize ──▶ merge/dedupe ──▶ score ──▶ validate ──▶ cache
```

1. **Validate** – `src/lib/linkedin/url.ts` canonicalises the input to a handle. Company pages, `/pub/` links and non-LinkedIn hosts are refused with specific messages.
2. **Providers** – each implements `ProfileProvider` (`src/lib/providers/types.ts`) and returns a `ProviderProfile` (plain values) plus `ProviderMeta` (observation time, base confidence, license, source URL). Every provider runs with an `AbortSignal` timeout; failures are recorded per-provider and never take the whole request down.
3. **Merge** – `src/lib/merge/merge.ts` de-duplicates lists with fuzzy matching per entity type (org-name normalisation, Dice similarity, date tolerance) and unions matched items field-by-field. Scalars that agree across sources get a noisy-OR confidence boost; disagreements keep the losing values as `conflicts`. Older observations are discounted (`freshnessFactor`).
4. **Output** – a `Profile` (`src/lib/schema/profile.ts`) with per-field provenance, `missing[]`, `coverage`, aggregate `confidence`, and a `providers[]` run log. Cached in KV for 24h (configurable).

## Providers

| id | Source | Kind | Enable with |
|---|---|---|---|
| `apify` | [Apify](https://apify.com/harvestapi/linkedin-profile-scraper) LinkedIn profile Actor, no-email mode | Your Apify account | `APIFY_TOKEN` |
| `wikidata` | Wikidata (P6634 "LinkedIn personal profile ID") + English Wikipedia summary | Open data (CC0 / CC BY-SA) | always on, no key |
| `github` | GitHub public REST API (enrichment: corroborates name/photo/location, adds top repos as projects) | Public API | always on; `GITHUB_TOKEN` optional for quota |
| `demo-a`, `demo-b`, `demo-larp` | Synthetic fixtures for the `demo` and `larp` handles | Fixture | `ENABLE_DEMO_PROVIDER` (default `true`) |

LinkedIn profile text is fetched only through Apify's API (`POST /v2/acts/{actor}/run-sync-get-dataset-items`), using the token on your Apify account. The default actor is `harvestapi/linkedin-profile-scraper` in "Profile details no email" mode. Override it with `APIFY_LINKEDIN_ACTOR` (`username~actor-name`). Without a token, real lookups succeed only for people Wikidata already links to a LinkedIn ID. Emails and phone numbers are never mapped.

### Adding a provider

Implement `ProfileProvider` in `src/lib/providers/<name>.ts`, map the vendor's shape to `ProviderProfile`, and add the factory to `buildProviders()` in `src/lib/providers/registry.ts`. Nothing else changes — the merger, cache, API and UI are provider-agnostic. Never map emails, phones or street addresses.

## API

```
GET /api/profile?url=<linkedin url | handle>[&refresh=1]
  200 { ok: true, profile, cache: { hit, cachedAt, expiresAt, ttlSeconds } }
  400 INVALID_INPUT · 404 NOT_FOUND · 429 RATE_LIMITED (Retry-After) · 502 UPSTREAM_ERROR · 503 NO_PROVIDERS

GET /api/health
  Which providers and infrastructure are live on this deployment. Never returns secrets.
```

Rate limiting applies to uncached lookups only (default 30 per 10 minutes per IP; `RateLimit-*` headers are returned). Cache hits are free.

## Configuration

Non-secret vars live in `wrangler.jsonc` → `vars`. Secrets are set with `wrangler secret put`.

| Variable | Default | Purpose |
|---|---|---|
| `APIFY_TOKEN` | – | secret · runs the LinkedIn Actor. [Apify Console → API & Integrations](https://console.apify.com/settings/integrations) |
| `APIFY_LINKEDIN_ACTOR` | `harvestapi~linkedin-profile-scraper` | swap the Actor |
| `APIFY_TIMEOUT_MS` | `55000` | how long to wait for the Actor |
| `GITHUB_TOKEN` | – | secret · raises GitHub API quota |
| `ENABLE_DEMO_PROVIDER` | `true` | serve the `/profile/demo` fixture |
| `CACHE_TTL_SECONDS` | `86400` | profile cache lifetime |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_SECONDS` | `30` / `600` | per-IP fixed window |
| `PROVIDER_TIMEOUT_MS` | `9000` | hard timeout per provider call |

Locally, copy `.env.example` to `.env.local`; `next dev` reads it and the OpenNext dev shim provides local KV via miniflare.

## Develop

```bash
npm install
npm run dev          # http://localhost:3000 (KV emulated locally)
npm test             # vitest
npm run lint && npm run typecheck
npm run preview      # build + run in the real Workers runtime (workerd)
```

## Deploy

```bash
npx wrangler login
npx wrangler kv namespace create PROFILE_CACHE   # paste ids into wrangler.jsonc
npx wrangler kv namespace create RATE_LIMIT
npx wrangler secret put APIFY_TOKEN
npm run deploy
```

### Continuous deployment from GitHub

`.github/workflows/deploy.yml` deploys `main` on every push. It needs two repository settings:

- **Variable** `CLOUDFLARE_ACCOUNT_ID` – your account id (`npx wrangler whoami`)
- **Secret** `CLOUDFLARE_API_TOKEN` – an API token with *Workers Scripts: Edit* and *Workers KV Storage: Edit* ([create one](https://dash.cloudflare.com/profile/api-tokens), template "Edit Cloudflare Workers")

Alternatively connect the repo in the Cloudflare dashboard under **Workers & Pages → dossier → Settings → Build** (Workers Builds); use `npx opennextjs-cloudflare build` as the build command and `npx opennextjs-cloudflare deploy` as the deploy command.

## Project layout

```
src/
  app/                      routes: /, /profile/[slug], /api/profile, /api/health
  components/               SearchForm, ui primitives, dossier/* (Header, Ledger, Sections, Conflicts)
  lib/
    linkedin/url.ts         URL parsing + validation
    schema/profile.ts       zod schemas: ProviderProfile → Profile (with provenance)
    providers/              one adapter per source + registry
    merge/                  similarity helpers + merge/dedupe/scoring
    infra/                  env, cache (KV/memory), rate limiter (KV/memory)
    service/getProfile.ts   orchestration
    errors.ts, format.ts
```

## Notes

- Profile pages are `noindex`. A profile that no source can supply renders an explanatory page (with each provider's verdict) rather than a bare 404; the JSON API returns proper status codes.
- Photos are rendered with `referrerpolicy="no-referrer"` straight from the provider host; Next's image optimizer is not used on Workers.
- Dossier is not affiliated with LinkedIn.
