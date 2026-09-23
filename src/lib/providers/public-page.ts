import { boolFromEnv, type RuntimeEnv } from "@/lib/infra/env";
import type { EducationInput, ExperienceInput, ProviderProfile } from "@/lib/schema/profile";
import type { LookupContext, LookupInput, ProfileProvider, ProviderOutcome } from "./types";
import { arr, classifyLink, httpUrl, str, toPartialDate } from "./util";

/**
 * Public profile page (JSON-LD) — OPT-IN, off by default.
 *
 * LinkedIn serves a logged-out "public profile" HTML page for many members that
 * embeds a schema.org `Person` JSON-LD block. This provider performs one plain
 * GET with no cookies or credentials, and reads only that structured block. If
 * LinkedIn answers with its auth wall or a 999, we report "unavailable" and stop.
 *
 * It is disabled unless ENABLE_PUBLIC_PAGE_PROVIDER=true because LinkedIn's
 * robots.txt and User Agreement restrict automated access; enabling it is an
 * operator decision. Licensed APIs (PDL, RapidAPI vendors) are the recommended path.
 */

const ID = "public-page";
const LABEL = "LinkedIn public page (JSON-LD)";
const LICENSE = "Publicly served page · operator opt-in";

type Ld = Record<string, unknown>;

export function extractJsonLd(html: string): Ld[] {
  const out: Ld[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim()) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const it of items) {
        if (it && typeof it === "object") {
          const o = it as Ld;
          if (Array.isArray(o["@graph"])) out.push(...(o["@graph"] as Ld[]));
          else out.push(o);
        }
      }
    } catch {
      // ignore malformed blocks
    }
  }
  return out;
}

export function mapPersonLd(person: Ld): ProviderProfile {
  const experience: ExperienceInput[] = [];
  for (const w of arr(person.worksFor) as Ld[]) {
    const company = str(w.name);
    if (!company) continue;
    const member = (w.member ?? {}) as Ld;
    const start = toPartialDate(member.startDate);
    const end = toPartialDate(member.endDate);
    experience.push({
      company,
      ...(httpUrl(w.url) ? { companyUrl: httpUrl(w.url) } : {}),
      ...(str(w.location) ? { location: str(w.location) } : {}),
      ...(str(w.description) ? { description: str(w.description) } : {}),
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
      ...(start && !end ? { current: true } : {}),
    });
  }
  const education: EducationInput[] = [];
  for (const a of arr(person.alumniOf) as Ld[]) {
    const school = str(a.name);
    if (!school) continue;
    const member = (a.member ?? {}) as Ld;
    const start = toPartialDate(member.startDate);
    const end = toPartialDate(member.endDate);
    education.push({
      school,
      ...(httpUrl(a.url) ? { schoolUrl: httpUrl(a.url) } : {}),
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
    });
  }
  const addr = person.address as Ld | undefined;
  const location = addr
    ? [str(addr.addressLocality), str(addr.addressRegion), str(addr.addressCountry)].filter(Boolean).join(", ")
    : undefined;

  const links = (arr(person.sameAs) as unknown[])
    .map((u) => httpUrl(u))
    .filter((u): u is string => Boolean(u))
    .map((url) => ({ network: classifyLink(url), url }));
  const url = httpUrl(person.url);
  if (url) links.unshift({ network: "linkedin", url });

  const image = person.image as Ld | string | undefined;
  const photoUrl = httpUrl(typeof image === "string" ? image : image?.contentUrl);

  return {
    ...(str(person.name) ? { fullName: str(person.name) } : {}),
    ...(photoUrl ? { photoUrl } : {}),
    ...(str(person.jobTitle) ? { headline: str(person.jobTitle), currentTitle: str(person.jobTitle) } : {}),
    ...(location ? { location } : {}),
    ...(str(person.description) ? { about: str(person.description) } : {}),
    ...(experience.length ? { experience, currentCompany: experience[0].company } : {}),
    ...(education.length ? { education } : {}),
    ...(links.length ? { links } : {}),
  };
}

export function createPublicPageProvider(env: RuntimeEnv): ProfileProvider {
  const enabled = boolFromEnv(env.ENABLE_PUBLIC_PAGE_PROVIDER, false);
  return {
    id: ID,
    label: LABEL,
    phase: "primary",
    baseConfidence: 0.75,
    license: LICENSE,
    isEnabled: () => enabled,
    disabledReason: () => "Off by default; set ENABLE_PUBLIC_PAGE_PROVIDER=true to opt in",

    async lookup(input: LookupInput, ctx: LookupContext): Promise<ProviderOutcome> {
      const observedAt = new Date().toISOString();
      const meta = { provider: ID, label: LABEL, observedAt, baseConfidence: 0.75, license: LICENSE, sourceUrl: input.canonicalUrl };
      const res = await fetch(input.canonicalUrl, {
        signal: ctx.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Dossier/0.1; +public-data profile viewer)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (res.status === 999 || res.status === 429) return { status: "unavailable", note: "LinkedIn declined the request (rate/bot check)." };
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location") ?? "";
        return { status: "unavailable", note: loc.includes("authwall") ? "LinkedIn served its auth wall — public page not available." : "LinkedIn redirected the request." };
      }
      if (res.status === 404) return { status: "empty", meta, note: "LinkedIn returned 404 for this handle." };
      if (res.status !== 200) return { status: "error", note: `LinkedIn responded ${res.status}.` };

      const html = await res.text();
      const person = extractJsonLd(html).find((o) => o["@type"] === "Person");
      if (!person) return { status: "unavailable", note: "Public page contained no structured Person data." };
      const profile = mapPersonLd(person);
      if (!profile.fullName) return { status: "empty", meta };
      return { status: "ok", profile, meta };
    },
  };
}
