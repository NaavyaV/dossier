import {
  FIELD_KEYS,
  type Certification,
  type Education,
  type Experience,
  type Field,
  type FieldKey,
  type Link,
  type PartialDate,
  type Profile,
  type Project,
  type Provenance,
  type ProviderMeta,
  type ProviderProfile,
  type ProviderRun,
  type Publication,
  type Skill,
  type Volunteer,
} from "@/lib/schema/profile";
import { dice, normalizeText, sameOrg, similarTitle, tokenOverlap } from "./similarity";

/**
 * Merge N provider profiles into one dossier.
 *
 * Rules:
 *  - Every value carries provenance. Agreement across sources raises confidence
 *    (noisy-OR); disagreement keeps the losing values as `conflicts`.
 *  - Older observations are discounted so a fresh source beats a stale one.
 *  - Lists are de-duplicated with fuzzy matching per entity type, and matched
 *    items are unioned field-by-field (higher-confidence source wins per field).
 */

export type MergeInput = { profile: ProviderProfile; meta: ProviderMeta };

const DAY = 86_400_000;

/** Discount for age of observation. */
export function freshnessFactor(observedAt: string, now = Date.now()): number {
  const age = (now - Date.parse(observedAt)) / DAY;
  if (!Number.isFinite(age) || age <= 30) return 1;
  if (age <= 180) return 0.95;
  if (age <= 365) return 0.9;
  if (age <= 730) return 0.8;
  return 0.7;
}

/** Noisy-OR combination: independent sources agreeing → higher confidence. */
export function combine(confidences: number[]): number {
  let miss = 1;
  for (const c of confidences) miss *= 1 - Math.min(0.99, Math.max(0, c));
  return round(1 - miss);
}

const round = (n: number) => Math.round(n * 1000) / 1000;

function provenance(meta: ProviderMeta, now: number): Provenance {
  return {
    provider: meta.provider,
    label: meta.label,
    observedAt: meta.observedAt,
    confidence: round(meta.baseConfidence * freshnessFactor(meta.observedAt, now)),
    ...(meta.sourceUrl ? { url: meta.sourceUrl } : {}),
    ...(meta.license ? { license: meta.license } : {}),
  };
}

// ---------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------

type Candidate<T> = { value: T; source: Provenance; order: number };

function mergeScalar<T>(
  cands: Candidate<T>[],
  same: (a: T, b: T) => boolean,
  opts: { trackConflicts?: boolean } = { trackConflicts: true },
): Field<T> | null {
  if (!cands.length) return null;
  const groups: Candidate<T>[][] = [];
  for (const c of cands) {
    const g = groups.find((grp) => same(grp[0].value, c.value));
    if (g) g.push(c);
    else groups.push([c]);
  }
  const scored = groups
    .map((g) => ({ g, conf: combine(g.map((c) => c.source.confidence)), order: Math.min(...g.map((c) => c.order)) }))
    .sort((a, b) => b.conf - a.conf || a.order - b.order);
  const win = scored[0];
  // Representative value: the highest-confidence member's value (keeps richest text).
  const rep = [...win.g].sort((a, b) => b.source.confidence - a.source.confidence || a.order - b.order)[0];
  const conflicts = opts.trackConflicts
    ? scored.slice(1).map((s) => {
        const r = [...s.g].sort((a, b) => b.source.confidence - a.source.confidence)[0];
        return { value: r.value, source: r.source };
      })
    : [];
  return {
    value: rep.value,
    sources: win.g.map((c) => c.source),
    confidence: win.conf,
    ...(conflicts.length ? { conflicts } : {}),
  };
}

const sameString = (a: string, b: string) => normalizeText(a) === normalizeText(b);
const sameLoose = (a: string, b: string) => sameString(a, b) || dice(a, b) >= 0.85 || tokenOverlap(a, b) >= 0.8;
const sameUrl = (a: string, b: string) => canonUrl(a) === canonUrl(b);

export function canonUrl(u: string): string {
  try {
    const x = new URL(u);
    x.hash = "";
    for (const k of [...x.searchParams.keys()]) if (/^utm_|^ref$|^source$/i.test(k)) x.searchParams.delete(k);
    const host = x.hostname.replace(/^www\./, "").toLowerCase();
    const path = x.pathname.replace(/\/+$/, "").toLowerCase();
    const q = x.searchParams.toString();
    return `${host}${path}${q ? `?${q}` : ""}`;
  } catch {
    return u.trim().toLowerCase();
  }
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

type Tagged<T> = { item: T; source: Provenance; order: number };

function yearOf(d?: PartialDate) {
  return d?.year;
}
function datesCompatible(a?: PartialDate, b?: PartialDate, tolYears = 1): boolean {
  const ya = yearOf(a);
  const yb = yearOf(b);
  if (ya === undefined || yb === undefined) return true;
  return Math.abs(ya - yb) <= tolYears;
}
function dateKey(d?: PartialDate): number {
  if (!d) return -Infinity;
  return d.year * 10000 + (d.month ?? 0) * 100 + (d.day ?? 0);
}

/**
 * Generic fuzzy de-dup. Matched items are unioned: for each field, take the value
 * from the highest-confidence source that has it.
 */
function mergeList<I extends object, O extends I & { id: string; sources: Provenance[]; confidence: number }>(
  tagged: Tagged<I>[],
  isDup: (a: I, b: I) => boolean,
  idPrefix: string,
  sort: (a: O, b: O) => number,
): O[] {
  const clusters: Tagged<I>[][] = [];
  for (const t of tagged) {
    const c = clusters.find((cl) => cl.some((x) => isDup(x.item, t.item)));
    if (c) c.push(t);
    else clusters.push([t]);
  }
  const out = clusters.map((cl) => {
    const ordered = [...cl].sort((a, b) => b.source.confidence - a.source.confidence || a.order - b.order);
    const merged: Record<string, unknown> = {};
    for (const t of ordered) {
      for (const [k, v] of Object.entries(t.item)) {
        if (v === undefined || v === null || v === "") continue;
        if (merged[k] === undefined) merged[k] = v;
        // Prefer longer descriptions regardless of source rank.
        else if (k === "description" && typeof v === "string" && typeof merged[k] === "string" && v.length > (merged[k] as string).length) merged[k] = v;
      }
    }
    // De-dupe provenance by provider (same provider can't corroborate itself).
    const seen = new Set<string>();
    const sources = ordered.map((t) => t.source).filter((s) => (seen.has(s.provider) ? false : (seen.add(s.provider), true)));
    return { ...(merged as I), id: "", sources, confidence: combine(sources.map((s) => s.confidence)) } as O;
  });
  out.sort(sort);
  out.forEach((o, i) => (o.id = `${idPrefix}-${i + 1}`));
  return out;
}

const byRecency =
  <T extends { start?: PartialDate; end?: PartialDate; current?: boolean }>() =>
  (a: T, b: T) => {
    const ac = a.current || (a.start && !a.end) ? 1 : 0;
    const bc = b.current || (b.start && !b.end) ? 1 : 0;
    if (ac !== bc) return bc - ac;
    return dateKey(b.start) - dateKey(a.start) || dateKey(b.end) - dateKey(a.end);
  };

function sameSkill(a: string, b: string): boolean {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (x === y) return true;
  if (x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x))) return true;
  return dice(x, y) >= 0.85 || tokenOverlap(x, y) >= 0.99;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export type MergedProfile = Omit<Profile, "larp">;

export function mergeProfiles(
  inputs: MergeInput[],
  ctx: { slug: string; linkedinUrl: string; runs: ProviderRun[]; now?: number },
): MergedProfile {
  const now = ctx.now ?? Date.now();
  const tagged = inputs.map((inp, order) => ({ ...inp, prov: provenance(inp.meta, now), order }));

  const cands = <T>(get: (p: ProviderProfile) => T | undefined): Candidate<T>[] =>
    tagged.flatMap((t) => {
      const v = get(t.profile);
      return v === undefined || v === null || v === "" ? [] : [{ value: v, source: t.prov, order: t.order }];
    });

  const fullName = mergeScalar(cands((p) => p.fullName), sameLoose);
  const headline = mergeScalar(cands((p) => p.headline), sameLoose);
  const location = mergeScalar(cands((p) => p.location), (a, b) => sameLoose(a, b) || tokenOverlap(a, b) >= 0.5);
  const about = mergeScalar(cands((p) => p.about), (a, b) => dice(a, b) >= 0.7);
  const photoUrl = mergeScalar(cands((p) => p.photoUrl), sameUrl, { trackConflicts: false });
  const currentRole = mergeScalar(
    cands((p) => (p.currentTitle || p.currentCompany ? { title: p.currentTitle, company: p.currentCompany } : undefined)),
    (a, b) => {
      const co = a.company && b.company ? sameOrg(a.company, b.company) : true;
      return co && similarTitle(a.title, b.title);
    },
  );

  const list = <I>(get: (p: ProviderProfile) => I[] | undefined): Tagged<I>[] =>
    tagged.flatMap((t) => (get(t.profile) ?? []).map((item) => ({ item, source: t.prov, order: t.order })));

  const experience = mergeList<Omit<Experience, "id" | "sources" | "confidence">, Experience>(
    list((p) => p.experience),
    (a, b) => sameOrg(a.company, b.company) && similarTitle(a.title, b.title) && datesCompatible(a.start, b.start) && datesCompatible(a.end, b.end),
    "exp",
    byRecency(),
  );
  const education = mergeList<Omit<Education, "id" | "sources" | "confidence">, Education>(
    list((p) => p.education),
    (a, b) => sameOrg(a.school, b.school) && datesCompatible(a.end, b.end, 2),
    "edu",
    (a, b) => dateKey(b.end) - dateKey(a.end) || dateKey(b.start) - dateKey(a.start),
  );
  const skills = mergeList<Omit<Skill, "id" | "sources" | "confidence">, Skill>(
    list((p) => p.skills),
    (a, b) => sameSkill(a.name, b.name),
    "skill",
    (a, b) => (b.endorsements ?? 0) - (a.endorsements ?? 0) || b.sources.length - a.sources.length || a.name.localeCompare(b.name),
  );
  const certifications = mergeList<Omit<Certification, "id" | "sources" | "confidence">, Certification>(
    list((p) => p.certifications),
    (a, b) => dice(a.name, b.name) >= 0.8 && (!a.issuer || !b.issuer || sameOrg(a.issuer, b.issuer)),
    "cert",
    (a, b) => dateKey(b.issued) - dateKey(a.issued),
  );
  const projects = mergeList<Omit<Project, "id" | "sources" | "confidence">, Project>(
    list((p) => p.projects),
    (a, b) => (a.url && b.url && sameUrl(a.url, b.url)) || dice(a.name, b.name) >= 0.8,
    "proj",
    (a, b) => dateKey(b.start) - dateKey(a.start),
  );
  const publications = mergeList<Omit<Publication, "id" | "sources" | "confidence">, Publication>(
    list((p) => p.publications),
    (a, b) => (a.url && b.url && sameUrl(a.url, b.url)) || dice(a.title, b.title) >= 0.8,
    "pub",
    (a, b) => dateKey(b.published) - dateKey(a.published),
  );
  const volunteer = mergeList<Omit<Volunteer, "id" | "sources" | "confidence">, Volunteer>(
    list((p) => p.volunteer),
    (a, b) => sameOrg(a.organization, b.organization) && similarTitle(a.role, b.role),
    "vol",
    byRecency(),
  );
  const links = mergeList<Omit<Link, "id" | "sources" | "confidence">, Link>(
    list((p) => p.links),
    (a, b) => sameUrl(a.url, b.url) || (a.network === b.network && !!a.handle && !!b.handle && a.handle.toLowerCase() === b.handle.toLowerCase()),
    "link",
    (a, b) => LINK_ORDER.indexOf(a.network) - LINK_ORDER.indexOf(b.network) || a.url.localeCompare(b.url),
  );
  // Always include the canonical LinkedIn URL.
  if (!links.some((l) => l.network === "linkedin")) {
    links.unshift({
      id: "link-0",
      network: "linkedin",
      url: ctx.linkedinUrl,
      sources: [{ provider: "input", label: "Provided URL", observedAt: new Date(now).toISOString(), confidence: 1 }],
      confidence: 1,
    });
  }

  const populated: Partial<Record<FieldKey, number>> = {};
  const put = (k: FieldKey, f: { confidence: number } | null | { confidence: number }[]) => {
    if (!f) return;
    if (Array.isArray(f)) {
      if (f.length) populated[k] = round(f.reduce((s, x) => s + x.confidence, 0) / f.length);
    } else populated[k] = f.confidence;
  };
  put("fullName", fullName);
  put("photoUrl", photoUrl);
  put("headline", headline);
  put("location", location);
  put("currentRole", currentRole);
  put("about", about);
  put("experience", experience);
  put("education", education);
  put("skills", skills);
  put("certifications", certifications);
  put("projects", projects);
  put("publications", publications);
  put("volunteer", volunteer);
  // Links only count as populated if something beyond the input URL exists.
  if (links.some((l) => l.sources.some((s) => s.provider !== "input"))) put("links", links);

  const missing = FIELD_KEYS.filter((k) => populated[k] === undefined);
  const confs = Object.values(populated) as number[];
  const confidence = confs.length ? round(confs.reduce((a, b) => a + b, 0) / confs.length) : 0;

  return {
    schemaVersion: 1,
    slug: ctx.slug,
    linkedinUrl: ctx.linkedinUrl,
    fullName,
    photoUrl,
    headline,
    location,
    currentRole,
    about,
    experience,
    education,
    skills,
    certifications,
    projects,
    publications,
    volunteer,
    links,
    missing,
    confidence,
    coverage: { populated: confs.length, total: FIELD_KEYS.length },
    synthetic: inputs.some((i) => i.meta.synthetic === true),
    providers: ctx.runs,
    generatedAt: new Date(now).toISOString(),
  };
}

const LINK_ORDER = ["linkedin", "website", "github", "twitter", "bluesky", "mastodon", "youtube", "instagram", "facebook", "threads", "medium", "substack", "scholar", "orcid", "crunchbase", "wikipedia", "wikidata"];
