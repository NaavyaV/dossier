import type { RuntimeEnv } from "@/lib/infra/env";
import type {
  EducationInput,
  ExperienceInput,
  LinkInput,
  PartialDate,
  ProviderProfile,
} from "@/lib/schema/profile";
import type { LookupContext, LookupInput, ProfileProvider, ProviderOutcome } from "./types";
import { fetchJson, httpUrl } from "./util";

/**
 * Wikidata + Wikipedia provider.
 *
 * Wikidata records a "LinkedIn personal profile ID" (P6634) for notable people.
 * The entity graph gives us employer/position/education with dated qualifiers,
 * an image (Wikimedia Commons), and social identifiers. The English Wikipedia
 * summary supplies the About text. Both are openly licensed (CC0 / CC BY-SA 4.0)
 * and require no API key — only a descriptive User-Agent.
 *
 * Freshness is real here: Wikidata exposes `dateModified` per entity.
 */

const UA = "Dossier/0.1 (+https://github.com/NaavyaV/dossier; public-data profile viewer)";
const ENTITY = (q: string) => `https://www.wikidata.org/wiki/Special:EntityData/${q}.json`;
const LABELS = (ids: string[]) =>
  `https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels&languages=en&format=json&ids=${ids.join("|")}`;
const WIKI_SUMMARY = (title: string) =>
  `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;

// Properties
const P = {
  image: "P18",
  employer: "P108",
  position: "P39",
  educatedAt: "P69",
  occupation: "P106",
  website: "P856",
  twitter: "P2002",
  github: "P2037",
  instagram: "P2003",
  facebook: "P2013",
  mastodon: "P4033",
  youtube: "P2397",
  scholar: "P1960",
  orcid: "P496",
  bluesky: "P12361",
  linkedin: "P6634",
  // qualifiers
  start: "P580",
  end: "P582",
  pointInTime: "P585",
  of: "P642",
  directs: "P2389",
  jurisdiction: "P1001",
  degree: "P512",
  major: "P812",
  residence: "P551",
  workLocation: "P937",
} as const;

type Snak = {
  datavalue?: {
    type: string;
    value: unknown;
  };
};
type Claim = {
  mainsnak: Snak;
  rank: "preferred" | "normal" | "deprecated";
  qualifiers?: Record<string, Snak[]>;
};
type Entity = {
  id: string;
  modified?: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, Claim[]>;
  sitelinks?: Record<string, { title: string; url?: string }>;
};

function idOf(s: Snak | undefined): string | undefined {
  const v = s?.datavalue?.value as { id?: string } | undefined;
  return v && typeof v.id === "string" ? v.id : undefined;
}
function strOf(s: Snak | undefined): string | undefined {
  const v = s?.datavalue?.value;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function timeOf(s: Snak | undefined): PartialDate | undefined {
  const v = s?.datavalue?.value as { time?: string; precision?: number } | undefined;
  if (!v?.time) return undefined;
  const m = /^[+-](\d{1,16})-(\d{2})-(\d{2})T/.exec(v.time);
  if (!m) return undefined;
  const year = Number(m[1]);
  if (year < 1900 || year > 2100) return undefined;
  const precision = v.precision ?? 9;
  const month = Number(m[2]);
  const day = Number(m[3]);
  return {
    year,
    ...(precision >= 10 && month >= 1 ? { month } : {}),
    ...(precision >= 11 && day >= 1 ? { day } : {}),
  };
}

const RANK = { preferred: 0, normal: 1, deprecated: 2 };
function claims(e: Entity, prop: string): Claim[] {
  return (e.claims?.[prop] ?? []).filter((c) => c.rank !== "deprecated").sort((a, b) => RANK[a.rank] - RANK[b.rank]);
}
/** Organisation a position/occupation is held at — Wikidata has used several qualifiers over time. */
function orgOf(c: Claim): string | undefined {
  return idOf(q(c, P.directs)) ?? idOf(q(c, P.of)) ?? idOf(q(c, P.employer)) ?? idOf(q(c, P.jurisdiction));
}
const PLACE_NOISE = /\b(house|home|residence|estate|mansion|villa|ranch|farm)\b/i;
function q(c: Claim, prop: string): Snak | undefined {
  return c.qualifiers?.[prop]?.[0];
}

async function resolveQid(slug: string, signal: AbortSignal): Promise<string | null> {
  // CirrusSearch `haswbstatement` is indexed and case-insensitive; ~100ms vs a
  // multi-second SPARQL scan for a case-insensitive FILTER.
  const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: `haswbstatement:${P.linkedin}=${slug}`,
    srlimit: "3",
    format: "json",
  })}`;
  const { status, body } = await fetchJson(url, { signal, headers: { "User-Agent": UA } });
  if (status !== 200) throw new Error(`Wikidata search ${status}`);
  const hits = (body as { query?: { search?: { title?: string }[] } }).query?.search ?? [];
  const qids = hits.map((h) => h.title).filter((t): t is string => Boolean(t && /^Q\d+$/.test(t)));
  if (!qids.length) return null;
  if (qids.length === 1) return qids[0];
  // Ambiguity is rare (IDs are unique) but confirm with an exact statement check.
  for (const qid of qids) {
    const ent = await fetchEntity(qid, signal).catch(() => null);
    const ids = ent ? claims(ent, P.linkedin).map((c) => strOf(c.mainsnak)?.toLowerCase()) : [];
    if (ids.includes(slug.toLowerCase())) return qid;
  }
  return qids[0];
}

async function fetchEntity(qid: string, signal: AbortSignal): Promise<Entity> {
  const { status, body } = await fetchJson(ENTITY(qid), { signal, headers: { "User-Agent": UA } });
  if (status !== 200) throw new Error(`EntityData ${status}`);
  const ent = (body as { entities?: Record<string, Entity> }).entities?.[qid];
  if (!ent) throw new Error("Entity missing");
  return ent;
}

async function fetchLabels(ids: string[], signal: AbortSignal): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = [...new Set(ids)].filter(Boolean);
  for (let i = 0; i < uniq.length; i += 50) {
    const batch = uniq.slice(i, i + 50);
    const { status, body } = await fetchJson(LABELS(batch), { signal, headers: { "User-Agent": UA } });
    if (status !== 200) continue;
    const ents = (body as { entities?: Record<string, { labels?: { en?: { value: string } } }> }).entities ?? {};
    for (const [id, e] of Object.entries(ents)) {
      const l = e.labels?.en?.value;
      if (l) out.set(id, l);
    }
  }
  return out;
}

async function fetchWikipediaSummary(
  title: string,
  signal: AbortSignal,
): Promise<{ extract?: string; thumbnail?: string; url?: string; timestamp?: string } | null> {
  const { status, body } = await fetchJson(WIKI_SUMMARY(title), { signal, headers: { "User-Agent": UA } });
  if (status !== 200) return null;
  const b = body as {
    extract?: string;
    thumbnail?: { source?: string };
    originalimage?: { source?: string };
    content_urls?: { desktop?: { page?: string } };
    timestamp?: string;
  };
  return {
    extract: b.extract,
    thumbnail: b.originalimage?.source ?? b.thumbnail?.source,
    url: b.content_urls?.desktop?.page,
    timestamp: b.timestamp,
  };
}

function commonsUrl(filename: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=512`;
}

const titleCase = (s: string) => s.replace(/(^|\s)([a-z])/g, (m, sp, ch) => sp + ch.toUpperCase());

const ID = "wikidata";
const LABEL = "Wikidata · Wikipedia";
const BASE_CONFIDENCE = 0.8;
const LICENSE = "Wikidata CC0 · Wikipedia CC BY-SA 4.0";

export function createWikidataProvider(_env: RuntimeEnv): ProfileProvider {
  return {
    id: ID,
    label: LABEL,
    phase: "primary",
    baseConfidence: BASE_CONFIDENCE,
    license: LICENSE,
    isEnabled: () => true,

    async lookup(input: LookupInput, ctx: LookupContext): Promise<ProviderOutcome> {
      const { signal } = ctx;
      const qid = await resolveQid(input.slug, signal);
      const observedAtFallback = new Date().toISOString();
      if (!qid) {
        return {
          status: "empty",
          note: "No Wikidata entity lists this LinkedIn ID.",
          meta: {
            provider: ID,
            label: LABEL,
            observedAt: observedAtFallback,
            baseConfidence: BASE_CONFIDENCE,
            license: LICENSE,
          },
        };
      }

      const ent = await fetchEntity(qid, signal);
      const observedAt = ent.modified ?? observedAtFallback;
      const sourceUrl = `https://www.wikidata.org/wiki/${qid}`;

      // Gather every QID we need a label for.
      const need: string[] = [];
      const employerClaims = claims(ent, P.employer);
      const positionClaims = claims(ent, P.position);
      const eduClaims = claims(ent, P.educatedAt);
      const occupationClaims = claims(ent, P.occupation);
      for (const c of [...employerClaims, ...positionClaims, ...eduClaims, ...occupationClaims]) {
        const id = idOf(c.mainsnak);
        if (id) need.push(id);
        const org = orgOf(c);
        if (org) need.push(org);
        for (const qp of [P.degree, P.major]) {
          const qi = idOf(q(c, qp));
          if (qi) need.push(qi);
        }
      }
      for (const c of [...claims(ent, P.residence), ...claims(ent, P.workLocation)]) {
        const id = idOf(c.mainsnak);
        if (id) need.push(id);
      }
      const labels = await fetchLabels(need, signal);
      const L = (id: string | undefined) => (id ? labels.get(id) : undefined);

      // Experience: positions/occupations held at an organisation ("CEO of Microsoft"),
      // then bare employers that aren't already covered.
      const experience: ExperienceInput[] = [];
      const seenRole = new Set<string>();
      for (const c of [...positionClaims, ...occupationClaims]) {
        const title = L(idOf(c.mainsnak));
        const org = L(orgOf(c));
        if (!title || !org) continue;
        const start = timeOf(q(c, P.start));
        const end = timeOf(q(c, P.end));
        const key = `${title}|${org}|${start?.year ?? ""}`.toLowerCase();
        if (seenRole.has(key)) continue;
        seenRole.add(key);
        experience.push({
          title: titleCase(title),
          company: org,
          ...(start ? { start } : {}),
          ...(end ? { end } : {}),
          ...(start && !end ? { current: true } : {}),
        });
      }
      for (const c of employerClaims) {
        const org = L(idOf(c.mainsnak));
        if (!org) continue;
        const start = timeOf(q(c, P.start));
        const end = timeOf(q(c, P.end));
        const dup = experience.find((e) => e.company.toLowerCase() === org.toLowerCase() && (start?.year ?? null) === (e.start?.year ?? null));
        if (dup) continue;
        // Preferred-rank employer with no end date is Wikidata's way of saying "current".
        const current = !end && (Boolean(start) || c.rank === "preferred");
        experience.push({
          company: org,
          ...(start ? { start } : {}),
          ...(end ? { end } : {}),
          ...(current ? { current: true } : {}),
        });
      }

      const education: EducationInput[] = [];
      for (const c of eduClaims) {
        const school = L(idOf(c.mainsnak));
        if (!school) continue;
        const degree = L(idOf(q(c, P.degree)));
        const field = L(idOf(q(c, P.major)));
        const start = timeOf(q(c, P.start));
        const end = timeOf(q(c, P.end)) ?? timeOf(q(c, P.pointInTime));
        education.push({
          school,
          ...(degree ? { degree: titleCase(degree) } : {}),
          ...(field ? { field: titleCase(field) } : {}),
          ...(start ? { start } : {}),
          ...(end ? { end } : {}),
        });
      }

      const links: LinkInput[] = [{ network: "wikidata", url: sourceUrl }];
      const push = (network: string, url: string | undefined, handle?: string) => {
        if (url) links.push({ network, url, ...(handle ? { handle } : {}) });
      };
      push("website", httpUrl(strOf(claims(ent, P.website)[0]?.mainsnak)));
      const tw = strOf(claims(ent, P.twitter)[0]?.mainsnak);
      push("twitter", tw ? `https://x.com/${tw}` : undefined, tw);
      const gh = strOf(claims(ent, P.github)[0]?.mainsnak);
      push("github", gh ? `https://github.com/${gh}` : undefined, gh);
      const ig = strOf(claims(ent, P.instagram)[0]?.mainsnak);
      push("instagram", ig ? `https://www.instagram.com/${ig}` : undefined, ig);
      const fb = strOf(claims(ent, P.facebook)[0]?.mainsnak);
      push("facebook", fb ? `https://www.facebook.com/${fb}` : undefined, fb);
      const md = strOf(claims(ent, P.mastodon)[0]?.mainsnak); // user@instance
      if (md && md.includes("@")) {
        const [user, inst] = md.split("@");
        push("mastodon", `https://${inst}/@${user}`, md);
      }
      const yt = strOf(claims(ent, P.youtube)[0]?.mainsnak);
      push("youtube", yt ? `https://www.youtube.com/channel/${yt}` : undefined);
      const sch = strOf(claims(ent, P.scholar)[0]?.mainsnak);
      push("scholar", sch ? `https://scholar.google.com/citations?user=${sch}` : undefined);
      const orcid = strOf(claims(ent, P.orcid)[0]?.mainsnak);
      push("orcid", orcid ? `https://orcid.org/${orcid}` : undefined, orcid);
      const bsky = strOf(claims(ent, P.bluesky)[0]?.mainsnak);
      push("bluesky", bsky ? `https://bsky.app/profile/${bsky}` : undefined, bsky);

      // Wikipedia summary for About + fallback photo.
      const wikiTitle = ent.sitelinks?.enwiki?.title;
      let about: string | undefined;
      let wikiPhoto: string | undefined;
      if (wikiTitle) {
        const s = await fetchWikipediaSummary(wikiTitle, signal).catch(() => null);
        if (s) {
          about = s.extract;
          wikiPhoto = s.thumbnail;
          if (s.url) links.push({ network: "wikipedia", url: s.url });
        }
      }

      const imageFile = strOf(claims(ent, P.image)[0]?.mainsnak);
      const photoUrl = imageFile ? commonsUrl(imageFile) : wikiPhoto;

      const current = experience.find((e) => e.current && e.title) ?? experience.find((e) => e.current) ?? experience[0];
      const description = ent.descriptions?.en?.value;
      const occupation = L(idOf(occupationClaims[0]?.mainsnak));
      const location = [...claims(ent, P.residence), ...claims(ent, P.workLocation)]
        .map((c) => L(idOf(c.mainsnak)))
        .find((l): l is string => Boolean(l) && !PLACE_NOISE.test(l!));

      const profile: ProviderProfile = {
        fullName: ent.labels?.en?.value,
        ...(photoUrl ? { photoUrl } : {}),
        ...(description ? { headline: description.charAt(0).toUpperCase() + description.slice(1) } : {}),
        ...(location ? { location } : {}),
        ...(current?.title ? { currentTitle: current.title } : !experience.length && occupation ? { currentTitle: titleCase(occupation) } : {}),
        ...(current?.company ? { currentCompany: current.company } : {}),
        ...(about ? { about } : {}),
        ...(experience.length ? { experience } : {}),
        ...(education.length ? { education } : {}),
        links,
      };

      return {
        status: "ok",
        profile,
        meta: {
          provider: ID,
          label: LABEL,
          observedAt,
          baseConfidence: BASE_CONFIDENCE,
          sourceUrl,
          license: LICENSE,
        },
      };
    },
  };
}
