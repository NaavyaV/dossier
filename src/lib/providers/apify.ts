import type { RuntimeEnv } from "@/lib/infra/env";
import { intFromEnv } from "@/lib/infra/env";
import { DEMO_SLUG, LARP_SLUG } from "./demo";
import type {
  CertificationInput,
  EducationInput,
  ExperienceInput,
  LinkInput,
  PartialDate,
  ProjectInput,
  PublicationInput,
  ProviderProfile,
  SkillInput,
  VolunteerInput,
} from "@/lib/schema/profile";
import type { LookupContext, LookupInput, ProfileProvider, ProviderOutcome } from "./types";
import { arr, classifyLink, fetchJson, httpUrl, str, toPartialDate } from "./util";

/**
 * LinkedIn profiles via an Apify Actor (official Apify API, the account's token).
 *
 * Default actor: harvestapi/linkedin-profile-scraper, "profile details, no email"
 * mode. Emails and phone numbers are never mapped, even if an actor returns them.
 * Swap actors with APIFY_LINKEDIN_ACTOR (`username~actor-name`).
 *
 * https://docs.apify.com/api/v2
 * https://apify.com/harvestapi/linkedin-profile-scraper
 */

const ID = "apify";
const LABEL = "LinkedIn";
const LICENSE = "Public profile";
const DEFAULT_ACTOR = "harvestapi~linkedin-profile-scraper";
const NO_EMAIL_MODE = "Profile details no email ($4 per 1k)";

type Rec = Record<string, unknown>;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** HarvestAPI dates are `{ month: "Jan", year: 2024, text }` or a string. */
export function apifyDate(input: unknown): PartialDate | undefined {
  if (!input || typeof input !== "object") return toPartialDate(input);
  const o = input as Rec;
  const text = str(o.text);
  if (text && /present|current/i.test(text) && o.year === undefined) return undefined;
  const year = typeof o.year === "number" ? o.year : undefined;
  const month = typeof o.month === "string" ? MONTHS[o.month.slice(0, 3).toLowerCase()] : undefined;
  if (year && year >= 1900 && year <= 2100) return { year, ...(month ? { month } : {}) };
  return toPartialDate(text);
}

function isPresent(input: unknown): boolean {
  if (!input) return false;
  if (typeof input === "string") return /present|current/i.test(input);
  if (typeof input === "object") return /present|current/i.test(str((input as Rec).text) ?? "");
  return false;
}

function endorsements(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  const m = typeof v === "string" ? /(\d[\d,]*)/.exec(v) : null;
  return m ? Number(m[1].replace(/,/g, "")) : undefined;
}

export function mapApify(d: Rec): ProviderProfile {
  const experience: ExperienceInput[] = [];
  for (const raw of arr(d.experience) as Rec[]) {
    const company = str(raw.companyName) ?? str(raw.company);
    if (!company) continue;
    const start = apifyDate(raw.startDate);
    const end = isPresent(raw.endDate) ? undefined : apifyDate(raw.endDate);
    const current = isPresent(raw.endDate) || Boolean(start && !raw.endDate);
    experience.push({
      company,
      ...(str(raw.position) ?? str(raw.title) ? { title: str(raw.position) ?? str(raw.title) } : {}),
      ...(httpUrl(raw.companyLinkedinUrl) ? { companyUrl: httpUrl(raw.companyLinkedinUrl) } : {}),
      ...(httpUrl(raw.companyLogo) ?? httpUrl(raw.logo) ? { companyLogoUrl: httpUrl(raw.companyLogo) ?? httpUrl(raw.logo) } : {}),
      ...(str(raw.location) ? { location: str(raw.location) } : {}),
      ...(str(raw.employmentType) ? { employmentType: str(raw.employmentType) } : {}),
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
      ...(current ? { current: true } : {}),
      ...(str(raw.description) ? { description: str(raw.description) } : {}),
    });
  }

  const education: EducationInput[] = [];
  for (const raw of arr(d.education) as Rec[]) {
    const school = str(raw.schoolName) ?? str(raw.school);
    if (!school) continue;
    const start = apifyDate(raw.startDate);
    const end = apifyDate(raw.endDate);
    education.push({
      school,
      ...(httpUrl(raw.schoolLinkedinUrl) ? { schoolUrl: httpUrl(raw.schoolLinkedinUrl) } : {}),
      ...(str(raw.degree) ? { degree: str(raw.degree) } : {}),
      ...(str(raw.fieldOfStudy) ?? str(raw.field) ? { field: str(raw.fieldOfStudy) ?? str(raw.field) } : {}),
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
      ...(str(raw.description) ? { description: str(raw.description) } : {}),
    });
  }

  const skills: SkillInput[] = [];
  const seen = new Set<string>();
  for (const raw of arr(d.skills)) {
    const name = typeof raw === "string" ? str(raw) : str((raw as Rec).name);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const n = typeof raw === "object" && raw ? endorsements((raw as Rec).endorsements) : undefined;
    skills.push({ name, ...(n !== undefined ? { endorsements: n } : {}) });
  }

  const certifications: CertificationInput[] = [];
  for (const raw of arr(d.certifications) as Rec[]) {
    const name = str(raw.title) ?? str(raw.name);
    if (!name) continue;
    const issued = apifyDate(raw.issuedAt) ?? apifyDate(raw.issuedDate);
    certifications.push({
      name,
      ...(str(raw.issuedBy) ?? str(raw.authority) ? { issuer: str(raw.issuedBy) ?? str(raw.authority) } : {}),
      ...(issued ? { issued } : {}),
      ...(httpUrl(raw.issuedByLink) ?? httpUrl(raw.url) ? { url: httpUrl(raw.issuedByLink) ?? httpUrl(raw.url) } : {}),
    });
  }

  const projects: ProjectInput[] = [];
  for (const raw of arr(d.projects) as Rec[]) {
    const name = str(raw.title) ?? str(raw.name);
    if (!name) continue;
    const start = apifyDate(raw.startDate);
    const end = isPresent(raw.endDate) ? undefined : apifyDate(raw.endDate);
    projects.push({
      name,
      ...(str(raw.description) ? { description: str(raw.description) } : {}),
      ...(httpUrl(raw.link) ?? httpUrl(raw.url) ? { url: httpUrl(raw.link) ?? httpUrl(raw.url) } : {}),
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
    });
  }

  const publications: PublicationInput[] = [];
  for (const raw of arr(d.publications) as Rec[]) {
    const title = str(raw.title) ?? str(raw.name);
    if (!title) continue;
    const published = apifyDate(raw.publishedAt) ?? apifyDate(raw.date);
    publications.push({
      title,
      ...(str(raw.publisher) ? { publisher: str(raw.publisher) } : {}),
      ...(published ? { published } : {}),
      ...(httpUrl(raw.link) ?? httpUrl(raw.url) ? { url: httpUrl(raw.link) ?? httpUrl(raw.url) } : {}),
      ...(str(raw.description) ? { description: str(raw.description) } : {}),
    });
  }

  const volunteer: VolunteerInput[] = [];
  for (const raw of arr(d.volunteering ?? d.volunteer) as Rec[]) {
    const organization = str(raw.organizationName) ?? str(raw.organization);
    const role = str(raw.role) ?? str(raw.title);
    if (!organization || !role) continue;
    const start = apifyDate(raw.startDate);
    const end = isPresent(raw.endDate) ? undefined : apifyDate(raw.endDate);
    volunteer.push({
      role,
      organization,
      ...(str(raw.cause) ? { cause: str(raw.cause) } : {}),
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
      ...(str(raw.description) ? { description: str(raw.description) } : {}),
    });
  }

  const links: LinkInput[] = [];
  const pushLink = (url: string | undefined) => {
    if (url && !links.some((l) => l.url === url)) links.push({ network: classifyLink(url), url });
  };
  pushLink(httpUrl(d.linkedinUrl));
  for (const key of ["website", "twitter", "github"]) {
    const v = d[key];
    if (typeof v === "string") pushLink(httpUrl(v));
    else if (v && typeof v === "object") pushLink(httpUrl((v as Rec).url) ?? httpUrl((v as Rec).link));
  }

  const loc = d.location;
  const location =
    typeof loc === "string"
      ? loc
      : loc && typeof loc === "object"
        ? str((loc as Rec).linkedinText) ?? str(((loc as Rec).parsed as Rec | undefined)?.text)
        : undefined;

  const fullName = str(d.fullName) ?? [str(d.firstName), str(d.lastName)].filter(Boolean).join(" ");
  const current = (arr(d.currentPosition)[0] ?? {}) as Rec;
  const currentCompany = str(current.companyName) ?? experience.find((e) => e.current)?.company;
  const currentTitle = str(current.position) ?? experience.find((e) => e.current)?.title;

  return {
    ...(fullName ? { fullName } : {}),
    ...(httpUrl(d.photo) ?? httpUrl(d.profilePicture) ? { photoUrl: httpUrl(d.photo) ?? httpUrl(d.profilePicture) } : {}),
    ...(str(d.headline) ? { headline: str(d.headline) } : {}),
    ...(location ? { location } : {}),
    ...(currentTitle ? { currentTitle } : {}),
    ...(currentCompany ? { currentCompany } : {}),
    ...(str(d.about) ?? str(d.summary) ? { about: str(d.about) ?? str(d.summary) } : {}),
    ...(experience.length ? { experience } : {}),
    ...(education.length ? { education } : {}),
    ...(skills.length ? { skills } : {}),
    ...(certifications.length ? { certifications } : {}),
    ...(projects.length ? { projects } : {}),
    ...(publications.length ? { publications } : {}),
    ...(volunteer.length ? { volunteer } : {}),
    ...(links.length ? { links } : {}),
  };
}

function actorId(env: RuntimeEnv): string {
  const raw = env.APIFY_LINKEDIN_ACTOR?.trim() || DEFAULT_ACTOR;
  return raw.replace("/", "~");
}

const SAVED_TTL_SECONDS = 30 * 24 * 60 * 60;
const EMPTY_TTL_SECONDS = 7 * 24 * 60 * 60;
const savedKey = (slug: string) => `apify:v1:${slug}`;
const lockKey = (slug: string) => `apify:lock:${slug}`;

type Saved = { status: "ok"; profile: ProviderProfile; observedAt: string } | { status: "empty"; observedAt: string };

function outcomeFromSaved(saved: Saved, canonicalUrl: string): ProviderOutcome {
  const meta = {
    provider: ID,
    label: LABEL,
    observedAt: saved.observedAt,
    baseConfidence: 0.84,
    license: LICENSE,
    sourceUrl: canonicalUrl,
  };
  if (saved.status === "empty") return { status: "empty", meta, note: "Already checked. No public profile." };
  return { status: "ok", profile: saved.profile, meta };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createApifyProvider(env: RuntimeEnv): ProfileProvider {
  const token = env.APIFY_TOKEN;
  const actor = actorId(env);
  const kv = env.PROFILE_CACHE;
  return {
    id: ID,
    label: LABEL,
    phase: "primary",
    baseConfidence: 0.84,
    license: LICENSE,
    timeoutMs: intFromEnv(env.APIFY_TIMEOUT_MS, 55_000),
    isEnabled: () => Boolean(token),
    disabledReason: () => "APIFY_TOKEN not set — LinkedIn profiles need an Apify token",

    async lookup(input: LookupInput, ctx: LookupContext): Promise<ProviderOutcome> {
      if (input.slug === DEMO_SLUG || input.slug === LARP_SLUG) {
        return { status: "skipped", note: "Sample profiles are not fetched from LinkedIn." };
      }

      const readSaved = async () => (kv ? kv.get<Saved>(savedKey(input.slug), "json") : null);
      const saved = await readSaved();
      if (saved?.status === "ok" || saved?.status === "empty") return outcomeFromSaved(saved, input.canonicalUrl);

      if (kv) {
        const locked = await kv.get(lockKey(input.slug));
        if (locked) {
          for (let i = 0; i < 25 && !ctx.signal.aborted; i++) {
            await sleep(1000);
            const later = await readSaved();
            if (later?.status === "ok" || later?.status === "empty") return outcomeFromSaved(later, input.canonicalUrl);
          }
          return { status: "unavailable", note: "This profile is already being fetched." };
        }
        await kv.put(lockKey(input.slug), "1", { expirationTtl: 90 });
      }

      try {
        return await fetchOnce();
      } finally {
        await kv?.delete(lockKey(input.slug));
      }

      async function fetchOnce(): Promise<ProviderOutcome> {
      const timeoutSec = Math.max(10, Math.floor((intFromEnv(env.APIFY_TIMEOUT_MS, 55_000) - 4000) / 1000));
      const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items?timeout=${timeoutSec}`;
      const { status, body } = await fetchJson(url, {
        method: "POST",
        signal: ctx.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          profileScraperMode: NO_EMAIL_MODE,
          queries: [input.canonicalUrl],
        }),
      });

      const observedAt = new Date().toISOString();
      const meta = {
        provider: ID,
        label: LABEL,
        observedAt,
        baseConfidence: 0.84,
        license: LICENSE,
        sourceUrl: input.canonicalUrl,
      };

      if (status === 401 || status === 403) return { status: "error", note: "Apify rejected the API token." };
      if (status === 402) return { status: "unavailable", note: "Apify account has no credit for this Actor run." };
      if (status === 404) return { status: "error", note: `Apify actor “${actor}” was not found.` };
      if (status === 408 || status === 504) return { status: "unavailable", note: "The Apify run did not finish in time." };
      if (status === 429) return { status: "unavailable", note: "Apify rate limit reached." };
      if (status !== 200 && status !== 201) {
        const message = body && typeof body === "object" ? str((body as Rec).error && ((body as Rec).error as Rec).message) : undefined;
        return { status: "error", note: message ?? `Apify responded ${status}.` };
      }

      const items = Array.isArray(body) ? body : arr((body as Rec | null)?.items);
      const first = items.find((it) => it && typeof it === "object") as Rec | undefined;
      if (!first) {
        await remember({ status: "empty", observedAt });
        return { status: "empty", meta, note: "No public profile for this handle." };
      }
      const profile = mapApify(first);
      if (!profile.fullName && !profile.headline && !profile.experience?.length) {
        await remember({ status: "empty", observedAt });
        return { status: "empty", meta, note: "No usable public profile for this handle." };
      }
      await remember({ status: "ok", profile, observedAt });
      return { status: "ok", profile, meta };

      async function remember(entry: Saved) {
        const ttl = entry.status === "ok" ? SAVED_TTL_SECONDS : EMPTY_TTL_SECONDS;
        await kv?.put(savedKey(input.slug), JSON.stringify(entry), { expirationTtl: ttl });
      }
      }
    },
  };
}
