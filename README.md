# Dossier

Paste a public LinkedIn profile URL → get a structured, **sourced** professional profile.

Every field in a dossier carries the provider it came from, when that provider observed it, and a confidence score. Missing fields are listed, not hidden. Only legally obtained data is used: licensed vendor APIs and openly licensed datasets. Nothing logs in, sets cookies, or reads past an auth wall; emails and phone numbers are never collected.

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
                       primary: PDL · RapidAPI · Wikidata · public page (opt-in) · demo
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
| `pdl` | [People Data Labs](https://docs.peopledatalabs.com/docs/person-enrichment-api) Person Enrichment | Licensed API | `PDL_API_KEY` |
| `rapidapi` | LinkedIn-data vendors on RapidAPI (default host: Fresh LinkedIn Profile Data) | Licensed API | `RAPIDAPI_KEY` (+ optional `RAPIDAPI_LINKEDIN_HOST`) |
| `wikidata` | Wikidata (P6634 "LinkedIn personal profile ID") + English Wikipedia summary | Open data (CC0 / CC BY-SA) | always on, no key |
| `github` | GitHub public REST API (enrichment: corroborates name/photo/location, adds top repos as projects) | Public API | always on; `GITHUB_TOKEN` optional for quota |
| `public-page` | LinkedIn's logged-out public profile page, JSON-LD block only | Public page, **opt-in** | `ENABLE_PUBLIC_PAGE_PROVIDER=true` |
| `demo-a`, `demo-b` | Synthetic fixtures for the `demo` handle (fictional person) | Fixture | `ENABLE_DEMO_PROVIDER` (default `true`) |

The public-page provider is off by default: LinkedIn's robots.txt and User Agreement restrict automated access, so turning it on is an operator decision. Licensed APIs are the intended path for non-notable people. Without a vendor key, real lookups succeed only for people with a Wikidata entry that records their LinkedIn ID.

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
| `PDL_API_KEY` | – | secret · enables People Data Labs |
| `RAPIDAPI_KEY` | – | secret · enables the RapidAPI vendor |
| `RAPIDAPI_LINKEDIN_HOST` | `fresh-linkedin-profile-data.p.rapidapi.com` | swap vendors on the marketplace |
| `GITHUB_TOKEN` | – | secret · raises GitHub API quota |
| `ENABLE_PUBLIC_PAGE_PROVIDER` | `false` | opt in to the public-page provider |
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
npx wrangler secret put PDL_API_KEY              # optional
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
