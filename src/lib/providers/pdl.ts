import type { RuntimeEnv } from "@/lib/infra/env";
import type {
  CertificationInput,
  EducationInput,
  ExperienceInput,
  LinkInput,
  ProviderProfile,
} from "@/lib/schema/profile";
import type { LookupContext, LookupInput, ProfileProvider, ProviderOutcome } from "./types";
import { arr, classifyLink, fetchJson, httpUrl, str, toPartialDate } from "./util";

/**
 * People Data Labs — Person Enrichment API (licensed).
 * https://docs.peopledatalabs.com/docs/person-enrichment-api
 *
 * We pass the LinkedIn URL as the `profile` parameter. PDL returns a
 * `likelihood` score (1–10) which we fold into confidence. Contact details
 * (emails, phones, street addresses) are deliberately never mapped.
 */

const ID = "pdl";
const LABEL = "People Data Labs";
const LICENSE = "Licensed dataset (PDL Terms of Service)";
const ENDPOINT = "https://api.peopledatalabs.com/v5/person/enrich";

type PdlExperience = {
  company?: { name?: string; website?: string; location?: { name?: string } };
  title?: { name?: string };
  start_date?: string;
  end_date?: string;
  is_primary?: boolean;
  summary?: string;
  location_names?: string[];
};
type PdlEducation = {
  school?: { name?: string; website?: string };
  degrees?: string[];
  majors?: string[];
  start_date?: string;
  end_date?: string;
  summary?: string;
};
type PdlCertification = { name?: string; organization?: string; start_date?: string; end_date?: string };
type PdlProfile = { network?: string; url?: string; username?: string };

export function mapPdl(data: Record<string, unknown>): ProviderProfile {
  const experience: ExperienceInput[] = [];
  for (const raw of arr(data.experience) as PdlExperience[]) {
    const company = str(raw.company?.name);
    if (!company) continue;
    const start = toPartialDate(raw.start_date);
    const end = toPartialDate(raw.end_date);
    const loc = str(raw.company?.location?.name) ?? str(raw.location_names?.[0]);
    experience.push({
      company,
      ...(str(raw.title?.name) ? { title: str(raw.title?.name) } : {}),
      ...(httpUrl(raw.company?.website) ? { companyUrl: httpUrl(raw.company?.website) } : {}),
      ...(loc ? { location: loc } : {}),
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
      ...(!end && (raw.is_primary || start) ? { current: !end } : {}),
      ...(str(raw.summary) ? { description: str(raw.summary) } : {}),
    });
  }

  const education: EducationInput[] = [];
  for (const raw of arr(data.education) as PdlEducation[]) {
    const school = str(raw.school?.name);
    if (!school) continue;
    const start = toPartialDate(raw.start_date);
    const end = toPartialDate(raw.end_date);
    education.push({
      school,
      ...(httpUrl(raw.school?.website) ? { schoolUrl: httpUrl(raw.school?.website) } : {}),
      ...(raw.degrees?.length ? { degree: raw.degrees.join(", ") } : {}),
      ...(raw.majors?.length ? { field: raw.majors.join(", ") } : {}),
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
      ...(str(raw.summary) ? { description: str(raw.summary) } : {}),
    });
  }

  const certifications: CertificationInput[] = [];
  for (const raw of arr(data.certifications) as PdlCertification[]) {
    const name = str(raw.name);
    if (!name) continue;
    const issued = toPartialDate(raw.start_date);
    const expires = toPartialDate(raw.end_date);
    certifications.push({
      name,
      ...(str(raw.organization) ? { issuer: str(raw.organization) } : {}),
      ...(issued ? { issued } : {}),
      ...(expires ? { expires } : {}),
    });
  }

  const links: LinkInput[] = [];
  for (const raw of arr(data.profiles) as PdlProfile[]) {
    const url = httpUrl(raw.url);
    if (!url) continue;
    const network = str(raw.network) ?? classifyLink(url);
    links.push({ network: network.toLowerCase(), url, ...(str(raw.username) ? { handle: str(raw.username) } : {}) });
  }
  for (const k of ["github_url", "twitter_url", "facebook_url"] as const) {
    const url = httpUrl(data[k]);
    if (url && !links.some((l) => l.url === url)) links.push({ network: classifyLink(url), url });
  }

  const skills = (arr(data.skills) as unknown[])
    .map((s) => str(s))
    .filter((s): s is string => Boolean(s))
    .map((name) => ({ name }));

  const fullName = str(data.full_name) ?? [str(data.first_name), str(data.last_name)].filter(Boolean).join(" ");
  const currentTitle = str(data.job_title);
  const currentCompany = str(data.job_company_name);
  const headline = str(data.headline) ?? (currentTitle && currentCompany ? `${currentTitle} at ${currentCompany}` : undefined);

  return {
    ...(fullName ? { fullName } : {}),
    ...(headline ? { headline } : {}),
    ...(str(data.location_name) ? { location: str(data.location_name) } : {}),
    ...(currentTitle ? { currentTitle } : {}),
    ...(currentCompany ? { currentCompany } : {}),
    ...(str(data.summary) ? { about: str(data.summary) } : {}),
    ...(experience.length ? { experience } : {}),
    ...(education.length ? { education } : {}),
    ...(skills.length ? { skills } : {}),
    ...(certifications.length ? { certifications } : {}),
    ...(links.length ? { links } : {}),
  };
}

export function createPdlProvider(env: RuntimeEnv): ProfileProvider {
  const key = env.PDL_API_KEY;
  return {
    id: ID,
    label: LABEL,
    phase: "primary",
    baseConfidence: 0.85,
    license: LICENSE,
    isEnabled: () => Boolean(key),
    disabledReason: () => "PDL_API_KEY not set",

    async lookup(input: LookupInput, ctx: LookupContext): Promise<ProviderOutcome> {
      const url = `${ENDPOINT}?${new URLSearchParams({
        profile: input.canonicalUrl,
        min_likelihood: "6",
        pretty: "false",
      })}`;
      const { status, body } = await fetchJson(url, {
        signal: ctx.signal,
        headers: { "X-Api-Key": key!, Accept: "application/json" },
      });
      const observedAt = new Date().toISOString();
      const meta = { provider: ID, label: LABEL, observedAt, baseConfidence: 0.85, license: LICENSE };

      if (status === 404) return { status: "empty", meta, note: "No match in PDL for this profile." };
      if (status === 401 || status === 403) return { status: "error", note: "PDL rejected the API key." };
      if (status === 402) return { status: "unavailable", note: "PDL quota exhausted." };
      if (status === 429) return { status: "unavailable", note: "PDL rate limit reached." };
      if (status !== 200) return { status: "error", note: `PDL responded ${status}.` };

      const b = body as { likelihood?: number; data?: Record<string, unknown> };
      if (!b.data) return { status: "empty", meta };
      const likelihood = typeof b.likelihood === "number" ? b.likelihood : 7;
      const confidence = Math.min(1, Math.max(0.5, likelihood / 10));
      return {
        status: "ok",
        profile: mapPdl(b.data),
        meta: { ...meta, baseConfidence: confidence, sourceUrl: httpUrl(b.data.linkedin_url) ?? input.canonicalUrl },
      };
    },
  };
}
