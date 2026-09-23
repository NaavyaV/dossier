import type { RuntimeEnv } from "@/lib/infra/env";
import type { LinkInput, ProjectInput, ProviderProfile } from "@/lib/schema/profile";
import type { LookupContext, LookupInput, ProfileProvider, ProviderOutcome } from "./types";
import { fetchJson, httpUrl, str, toPartialDate } from "./util";

/**
 * GitHub enrichment (public REST API, no auth required; token optional for quota).
 *
 * Runs after primary providers. If another source surfaced a GitHub handle, we
 * corroborate name/location/photo, add the bio-listed website/Twitter, and
 * surface pinned-equivalent projects (top public repos by stars) as Projects.
 */

const ID = "github";
const LABEL = "GitHub (public API)";
const LICENSE = "GitHub public REST API — public profile data only";

export function createGitHubProvider(env: RuntimeEnv): ProfileProvider {
  const token = env.GITHUB_TOKEN;
  return {
    id: ID,
    label: LABEL,
    phase: "enrich",
    baseConfidence: 0.7,
    license: LICENSE,
    isEnabled: () => true,

    async lookup(_input: LookupInput, ctx: LookupContext): Promise<ProviderOutcome> {
      const gh = ctx.partial.links?.find((l) => l.network === "github");
      const observedAt = new Date().toISOString();
      const meta = { provider: ID, label: LABEL, observedAt, baseConfidence: 0.7, license: LICENSE };
      if (!gh) return { status: "skipped", note: "No GitHub handle discovered by other sources." };

      const handle = gh.handle ?? new URL(gh.url).pathname.split("/").filter(Boolean)[0];
      if (!handle) return { status: "empty", meta };

      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "Dossier/0.1",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const user = await fetchJson(`https://api.github.com/users/${encodeURIComponent(handle)}`, { signal: ctx.signal, headers });
      if (user.status === 404) return { status: "empty", meta, note: `No GitHub user "${handle}".` };
      if (user.status === 403 || user.status === 429) return { status: "unavailable", note: "GitHub API rate limit reached." };
      if (user.status !== 200) return { status: "error", note: `GitHub responded ${user.status}.` };

      const u = user.body as Record<string, unknown>;
      if (u.type !== "User") return { status: "empty", meta, note: "GitHub handle is an organization." };

      const links: LinkInput[] = [{ network: "github", url: `https://github.com/${handle}`, handle }];
      const blog = httpUrl(u.blog);
      if (blog) links.push({ network: "website", url: blog });
      const tw = str(u.twitter_username);
      if (tw) links.push({ network: "twitter", url: `https://x.com/${tw}`, handle: tw });

      const projects: ProjectInput[] = [];
      const repos = await fetchJson(
        `https://api.github.com/users/${encodeURIComponent(handle)}/repos?type=owner&sort=updated&per_page=30`,
        { signal: ctx.signal, headers },
      ).catch(() => ({ status: 0, body: null }));
      if (repos.status === 200 && Array.isArray(repos.body)) {
        const top = (repos.body as Record<string, unknown>[])
          .filter((r) => !r.fork && !r.archived)
          .sort((a, b) => Number(b.stargazers_count ?? 0) - Number(a.stargazers_count ?? 0))
          .slice(0, 6);
        for (const r of top) {
          const name = str(r.name);
          if (!name) continue;
          const stars = Number(r.stargazers_count ?? 0);
          const desc = str(r.description);
          const start = toPartialDate(r.created_at);
          projects.push({
            name,
            ...(desc || stars ? { description: [desc, stars ? `★ ${stars.toLocaleString()}` : undefined].filter(Boolean).join(" · ") } : {}),
            url: `https://github.com/${handle}/${name}`,
            ...(start ? { start } : {}),
          });
        }
      }

      const profile: ProviderProfile = {
        ...(str(u.name) ? { fullName: str(u.name) } : {}),
        ...(httpUrl(u.avatar_url) ? { photoUrl: httpUrl(u.avatar_url) } : {}),
        ...(str(u.location) ? { location: str(u.location) } : {}),
        ...(str(u.company) ? { currentCompany: str(u.company)!.replace(/^@/, "") } : {}),
        ...(str(u.bio) ? { headline: str(u.bio) } : {}),
        ...(projects.length ? { projects } : {}),
        links,
      };
      return {
        status: "ok",
        profile,
        meta: { ...meta, observedAt: str(u.updated_at) ?? observedAt, sourceUrl: `https://github.com/${handle}` },
      };
    },
  };
}
