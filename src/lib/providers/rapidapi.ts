import type { RuntimeEnv } from "@/lib/infra/env";
import type {
  CertificationInput,
  EducationInput,
  ExperienceInput,
  LinkInput,
  ProjectInput,
  PublicationInput,
  ProviderProfile,
  VolunteerInput,
} from "@/lib/schema/profile";
import type { LookupContext, LookupInput, ProfileProvider, ProviderOutcome } from "./types";
import { arr, classifyLink, fetchJson, httpUrl, splitDateRange, str, toPartialDate } from "./util";

/**
 * RapidAPI-hosted LinkedIn data vendors (licensed via RapidAPI marketplace terms).
 *
 * Default host targets "Fresh LinkedIn Profile Data"; other vendors on the
 * marketplace return near-identical shapes, so the mapper is deliberately
 * tolerant of alternate key names. Override the host with RAPIDAPI_LINKEDIN_HOST.
 */

const ID = "rapidapi";
const LABEL = "RapidAPI · LinkedIn data vendor";
const LICENSE = "Licensed via RapidAPI marketplace terms";
const DEFAULT_HOST = "fresh-linkedin-profile-data.p.rapidapi.com";

type Rec = Record<string, unknown>;
const pick = (o: Rec, ...keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  return undefined;
};

export function mapRapid(d: Rec): ProviderProfile {
  const experience: ExperienceInput[] = [];
  for (const raw of arr(pick(d, "experiences", "experience", "positions")) as Rec[]) {
    const company = str(pick(raw, "company", "company_name", "companyName"));
    if (!company) continue;
    const range = splitDateRange(pick(raw, "date_range", "dateRange", "duration_text"));
    const start = toPartialDate(pick(raw, "start_date", "starts_at", "startDate")) ?? range.start;
    const end = toPartialDate(pick(raw, "end_date", "ends_at", "endDate")) ?? range.end;
    const current = typeof raw.is_current === "boolean" ? raw.is_current : range.current ?? (start && !end ? true : undefined);
    experience.push({
      company,
      ...(str(pick(raw, "title", "position")) ? { title: str(pick(raw, "title", "position")) } : {}),
      ...(httpUrl(pick(raw, "company_linkedin_url", "companyUrl", "company_url")) ? { companyUrl: httpUrl(pick(raw, "company_linkedin_url", "companyUrl", "company_url")) } : {}),
      ...(httpUrl(pick(raw, "company_logo_url", "logo", "company_logo")) ? { companyLogoUrl: httpUrl(pick(raw, "company_logo_url", "logo", "company_logo")) } : {}),
      ...(str(raw.location) ? { location: str(raw.location) } : {}),
      ...(str(pick(raw, "employment_type", "employmentType")) ? { employmentType: str(pick(raw, "employment_type", "employmentType")) } : {}),
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
      ...(current !== undefined ? { current } : {}),
      ...(str(pick(raw, "description", "summary")) ? { description: str(pick(raw, "description", "summary")) } : {}),
    });
  }

  const education: EducationInput[] = [];
  for (const raw of arr(pick(d, "educations", "education")) as Rec[]) {
    const school = str(pick(raw, "school", "school_name", "schoolName"));
    if (!school) continue;
    const range = splitDateRange(pick(raw, "date_range", "dateRange"));
    const start = toPartialDate(pick(raw, "start_date", "starts_at", "start_year")) ?? range.start;
    const end = toPartialDate(pick(raw, "end_date", "ends_at", "end_year")) ?? range.end;
    education.push({
      school,
      ...(httpUrl(pick(raw, "school_linkedin_url", "school_url")) ? { schoolUrl: httpUrl(pick(raw, "school_linkedin_url", "school_url")) } : {}),
      ...(str(pick(raw, "degree", "degree_name")) ? { degree: str(pick(raw, "degree", "degree_name")) } : {}),
      ...(str(pick(raw, "field_of_study", "fieldOfStudy", "field")) ? { field: str(pick(raw, "field_of_study", "fieldOfStudy", "field")) } : {}),
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
      ...(str(raw.description) ? { description: str(raw.description) } : {}),
    });
  }

  const skillsRaw = pick(d, "skills");
  const skills = (typeof skillsRaw === "string" ? skillsRaw.split(/\s*[|,]\s*/) : arr(skillsRaw))
    .map((s) => (typeof s === "string" ? str(s) : str((s as Rec).name)))
    .filter((s): s is string => Boolean(s))
    .map((name) => ({ name }));

  const certifications: CertificationInput[] = [];
  for (const raw of arr(pick(d, "certifications", "certificates")) as Rec[]) {
    const name = str(pick(raw, "name", "title"));
    if (!name) continue;
    const issued = toPartialDate(pick(raw, "issued", "issue_date", "date", "starts_at")) ?? splitDateRange(raw.date_range).start;
    certifications.push({
      name,
      ...(str(pick(raw, "issuer", "authority", "organization")) ? { issuer: str(pick(raw, "issuer", "authority", "organization")) } : {}),
      ...(issued ? { issued } : {}),
      ...(str(pick(raw, "credential_id", "license_number")) ? { credentialId: str(pick(raw, "credential_id", "license_number")) } : {}),
      ...(httpUrl(pick(raw, "url", "credential_url", "link")) ? { url: httpUrl(pick(raw, "url", "credential_url", "link")) } : {}),
    });
  }

  const projects: ProjectInput[] = [];
  for (const raw of arr(pick(d, "projects", "accomplishment_projects")) as Rec[]) {
    const name = str(pick(raw, "title", "name"));
    if (!name) continue;
    const range = splitDateRange(pick(raw, "date_range", "dateRange"));
    const start = toPartialDate(pick(raw, "start_date", "starts_at")) ?? range.start;
    const end = toPartialDate(pick(raw, "end_date", "ends_at")) ?? range.end;
    projects.push({
      name,
      ...(str(raw.description) ? { description: str(raw.description) } : {}),
      ...(httpUrl(pick(raw, "url", "link")) ? { url: httpUrl(pick(raw, "url", "link")) } : {}),
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
    });
  }

  const publications: PublicationInput[] = [];
  for (const raw of arr(pick(d, "publications", "accomplishment_publications")) as Rec[]) {
    const title = str(pick(raw, "title", "name"));
    if (!title) continue;
    const published = toPartialDate(pick(raw, "published_on", "date", "published_date"));
    publications.push({
      title,
      ...(str(pick(raw, "publisher", "publication")) ? { publisher: str(pick(raw, "publisher", "publication")) } : {}),
      ...(published ? { published } : {}),
      ...(httpUrl(pick(raw, "url", "link")) ? { url: httpUrl(pick(raw, "url", "link")) } : {}),
      ...(str(raw.description) ? { description: str(raw.description) } : {}),
    });
  }

  const volunteer: VolunteerInput[] = [];
  for (const raw of arr(pick(d, "volunteers", "volunteer_work", "volunteering")) as Rec[]) {
    const organization = str(pick(raw, "company", "organization", "org"));
    const role = str(pick(raw, "title", "role"));
    if (!organization || !role) continue;
    const range = splitDateRange(pick(raw, "date_range", "dateRange"));
    const start = toPartialDate(pick(raw, "start_date", "starts_at")) ?? range.start;
    const end = toPartialDate(pick(raw, "end_date", "ends_at")) ?? range.end;
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
  for (const k of ["linkedin_url", "website", "personal_website", "twitter_url", "github_url"]) {
    const url = httpUrl(d[k]);
    if (url && !links.some((l) => l.url === url)) links.push({ network: classifyLink(url), url });
  }
  for (const raw of arr(pick(d, "websites", "social_links")) as unknown[]) {
    const url = httpUrl(typeof raw === "string" ? raw : (raw as Rec).url);
    if (url && !links.some((l) => l.url === url)) links.push({ network: classifyLink(url), url });
  }

  const fullName = str(pick(d, "full_name", "fullName", "name")) ??
    [str(pick(d, "first_name", "firstName")), str(pick(d, "last_name", "lastName"))].filter(Boolean).join(" ");
  const location = str(pick(d, "location", "location_name")) ??
    [str(d.city), str(d.state), str(d.country)].filter(Boolean).join(", ");

  return {
    ...(fullName ? { fullName } : {}),
    ...(httpUrl(pick(d, "profile_image_url", "profile_picture_url", "profilePicture", "avatar")) ? { photoUrl: httpUrl(pick(d, "profile_image_url", "profile_picture_url", "profilePicture", "avatar")) } : {}),
    ...(str(d.headline) ? { headline: str(d.headline) } : {}),
    ...(location ? { location } : {}),
    ...(str(pick(d, "job_title", "current_title", "title")) ? { currentTitle: str(pick(d, "job_title", "current_title", "title")) } : {}),
    ...(str(pick(d, "company", "current_company", "company_name")) ? { currentCompany: str(pick(d, "company", "current_company", "company_name")) } : {}),
    ...(str(pick(d, "about", "summary")) ? { about: str(pick(d, "about", "summary")) } : {}),
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

export function createRapidApiProvider(env: RuntimeEnv): ProfileProvider {
  const key = env.RAPIDAPI_KEY;
  const host = env.RAPIDAPI_LINKEDIN_HOST ?? DEFAULT_HOST;
  return {
    id: ID,
    label: LABEL,
    phase: "primary",
    baseConfidence: 0.8,
    license: LICENSE,
    isEnabled: () => Boolean(key),
    disabledReason: () => "RAPIDAPI_KEY not set",

    async lookup(input: LookupInput, ctx: LookupContext): Promise<ProviderOutcome> {
      const params = new URLSearchParams({
        linkedin_url: input.canonicalUrl,
        include_skills: "true",
        include_certifications: "true",
        include_publications: "true",
        include_volunteers: "true",
        include_projects: "true",
        include_honors: "false",
      });
      const { status, body } = await fetchJson(`https://${host}/get-linkedin-profile?${params}`, {
        signal: ctx.signal,
        headers: { "x-rapidapi-key": key!, "x-rapidapi-host": host, Accept: "application/json" },
      });
      const observedAt = new Date().toISOString();
      const meta = { provider: ID, label: `${LABEL} (${host.split(".")[0]})`, observedAt, baseConfidence: 0.8, license: LICENSE, sourceUrl: input.canonicalUrl };

      if (status === 404) return { status: "empty", meta, note: "Vendor has no record for this profile." };
      if (status === 401 || status === 403) return { status: "error", note: "RapidAPI rejected the key or you are not subscribed to this API." };
      if (status === 429) return { status: "unavailable", note: "RapidAPI quota or rate limit reached." };
      if (status !== 200) return { status: "error", note: `Vendor responded ${status}.` };

      const b = body as Rec;
      const data = (b.data as Rec | undefined) ?? b;
      if (!data || typeof data !== "object" || Object.keys(data).length === 0) return { status: "empty", meta };
      const profile = mapRapid(data);
      if (!profile.fullName && !profile.headline && !profile.experience) return { status: "empty", meta };
      return { status: "ok", profile, meta };
    },
  };
}
