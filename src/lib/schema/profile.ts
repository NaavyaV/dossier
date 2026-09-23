import { z } from "zod";

/**
 * Canonical profile schema.
 *
 * Two layers:
 *  - `ProviderProfile`  — what a single provider returns: plain values, no provenance.
 *  - `Profile`          — the merged, user-facing dossier: every scalar wrapped in a
 *                         `Field` carrying provenance, and every list item tagged
 *                         with the sources that contributed to it.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Partial date as it appears on résumés: "2019", "2019-03", or a full date. */
export const PartialDate = z.object({
  year: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
});
export type PartialDate = z.infer<typeof PartialDate>;

export const Provenance = z.object({
  /** Provider id, e.g. "pdl", "wikidata". */
  provider: z.string(),
  /** Human label, e.g. "People Data Labs". */
  label: z.string(),
  /** ISO timestamp when this provider observed the data (its own freshness signal if it has one, else fetch time). */
  observedAt: z.string(),
  /** 0..1 confidence the provider places in this datum. */
  confidence: z.number().min(0).max(1),
  /** Where a human can go to see the source. */
  url: z.string().url().optional(),
  /** Licensing / data origin note shown in the UI. */
  license: z.string().optional(),
});
export type Provenance = z.infer<typeof Provenance>;

export const ProviderMeta = z.object({
  provider: z.string(),
  label: z.string(),
  observedAt: z.string(),
  baseConfidence: z.number().min(0).max(1),
  sourceUrl: z.string().url().optional(),
  license: z.string().optional(),
  /** Providers may mark themselves as synthetic (demo fixtures). */
  synthetic: z.boolean().optional(),
});
export type ProviderMeta = z.infer<typeof ProviderMeta>;

// ---------------------------------------------------------------------------
// Provider-level (raw normalized) entities — plain values
// ---------------------------------------------------------------------------

export const ExperienceInput = z.object({
  /** May be unknown for sources that only record employment (e.g. Wikidata "employer"). */
  title: z.string().min(1).optional(),
  company: z.string().min(1),
  companyUrl: z.string().url().optional(),
  companyLogoUrl: z.string().url().optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  start: PartialDate.optional(),
  end: PartialDate.optional(),
  current: z.boolean().optional(),
  description: z.string().optional(),
});
export type ExperienceInput = z.infer<typeof ExperienceInput>;

export const EducationInput = z.object({
  school: z.string().min(1),
  schoolUrl: z.string().url().optional(),
  degree: z.string().optional(),
  field: z.string().optional(),
  start: PartialDate.optional(),
  end: PartialDate.optional(),
  description: z.string().optional(),
});
export type EducationInput = z.infer<typeof EducationInput>;

export const CertificationInput = z.object({
  name: z.string().min(1),
  issuer: z.string().optional(),
  issued: PartialDate.optional(),
  expires: PartialDate.optional(),
  credentialId: z.string().optional(),
  url: z.string().url().optional(),
});
export type CertificationInput = z.infer<typeof CertificationInput>;

export const ProjectInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  url: z.string().url().optional(),
  start: PartialDate.optional(),
  end: PartialDate.optional(),
});
export type ProjectInput = z.infer<typeof ProjectInput>;

export const PublicationInput = z.object({
  title: z.string().min(1),
  publisher: z.string().optional(),
  published: PartialDate.optional(),
  url: z.string().url().optional(),
  description: z.string().optional(),
});
export type PublicationInput = z.infer<typeof PublicationInput>;

export const VolunteerInput = z.object({
  role: z.string().min(1),
  organization: z.string().min(1),
  cause: z.string().optional(),
  start: PartialDate.optional(),
  end: PartialDate.optional(),
  description: z.string().optional(),
});
export type VolunteerInput = z.infer<typeof VolunteerInput>;

export const LinkInput = z.object({
  /** Network id: "linkedin", "github", "twitter", "website", "wikipedia", ... */
  network: z.string().min(1),
  url: z.string().url(),
  handle: z.string().optional(),
});
export type LinkInput = z.infer<typeof LinkInput>;

export const SkillInput = z.object({
  name: z.string().min(1),
  endorsements: z.number().int().nonnegative().optional(),
});
export type SkillInput = z.infer<typeof SkillInput>;

/** What a single provider emits. Everything optional — providers fill what they know. */
export const ProviderProfile = z.object({
  fullName: z.string().min(1).optional(),
  photoUrl: z.string().url().optional(),
  headline: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  currentTitle: z.string().min(1).optional(),
  currentCompany: z.string().min(1).optional(),
  about: z.string().min(1).optional(),
  experience: z.array(ExperienceInput).optional(),
  education: z.array(EducationInput).optional(),
  skills: z.array(SkillInput).optional(),
  certifications: z.array(CertificationInput).optional(),
  projects: z.array(ProjectInput).optional(),
  publications: z.array(PublicationInput).optional(),
  volunteer: z.array(VolunteerInput).optional(),
  links: z.array(LinkInput).optional(),
});
export type ProviderProfile = z.infer<typeof ProviderProfile>;

// ---------------------------------------------------------------------------
// Merged (user-facing) entities — carry provenance
// ---------------------------------------------------------------------------

const withSources = <T extends z.ZodRawShape>(shape: T) =>
  z.object({
    ...shape,
    id: z.string(),
    sources: z.array(Provenance).min(1),
    confidence: z.number().min(0).max(1),
  });

export const Field = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({
    value: inner,
    sources: z.array(Provenance).min(1),
    confidence: z.number().min(0).max(1),
    /** Set when other providers disagreed; the losing values are kept for transparency. */
    conflicts: z
      .array(z.object({ value: inner, source: Provenance }))
      .optional(),
  });
export type Field<T> = {
  value: T;
  sources: Provenance[];
  confidence: number;
  conflicts?: { value: T; source: Provenance }[];
};

export const Experience = withSources(ExperienceInput.shape);
export const Education = withSources(EducationInput.shape);
export const Skill = withSources(SkillInput.shape);
export const Certification = withSources(CertificationInput.shape);
export const Project = withSources(ProjectInput.shape);
export const Publication = withSources(PublicationInput.shape);
export const Volunteer = withSources(VolunteerInput.shape);
export const Link = withSources(LinkInput.shape);

export type Experience = z.infer<typeof Experience>;
export type Education = z.infer<typeof Education>;
export type Skill = z.infer<typeof Skill>;
export type Certification = z.infer<typeof Certification>;
export type Project = z.infer<typeof Project>;
export type Publication = z.infer<typeof Publication>;
export type Volunteer = z.infer<typeof Volunteer>;
export type Link = z.infer<typeof Link>;

export const FIELD_KEYS = [
  "fullName",
  "photoUrl",
  "headline",
  "location",
  "currentRole",
  "about",
  "experience",
  "education",
  "skills",
  "certifications",
  "projects",
  "publications",
  "volunteer",
  "links",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export const FIELD_LABELS: Record<FieldKey, string> = {
  fullName: "Name",
  photoUrl: "Photo",
  headline: "Headline",
  location: "Location",
  currentRole: "Current role",
  about: "About",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  projects: "Projects",
  publications: "Publications",
  volunteer: "Volunteer work",
  links: "Links",
};

export const ProviderRun = z.object({
  provider: z.string(),
  label: z.string(),
  status: z.enum(["ok", "empty", "skipped", "error", "unavailable"]),
  /** Milliseconds the provider took. */
  durationMs: z.number().nonnegative(),
  observedAt: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  license: z.string().optional(),
  /** Human-readable note: why it was skipped, or what went wrong. Never includes secrets. */
  note: z.string().optional(),
  fieldsContributed: z.array(z.string()).optional(),
});
export type ProviderRun = z.infer<typeof ProviderRun>;

export const LarpSignal = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string(),
  points: z.number(),
});
export type LarpSignal = z.infer<typeof LarpSignal>;

export const LarpScore = z.object({
  percent: z.number().int().min(0).max(100),
  verdict: z.enum(["grounded", "polished", "inflated", "full-larp"]),
  line: z.string(),
  signals: z.array(LarpSignal),
});
export type LarpScore = z.infer<typeof LarpScore>;

export const Profile = z.object({
  schemaVersion: z.literal(1),
  slug: z.string(),
  linkedinUrl: z.string().url(),

  fullName: Field(z.string()).nullable(),
  photoUrl: Field(z.string().url()).nullable(),
  headline: Field(z.string()).nullable(),
  location: Field(z.string()).nullable(),
  currentRole: Field(
    z.object({ title: z.string().optional(), company: z.string().optional() }),
  ).nullable(),
  about: Field(z.string()).nullable(),

  experience: z.array(Experience),
  education: z.array(Education),
  skills: z.array(Skill),
  certifications: z.array(Certification),
  projects: z.array(Project),
  publications: z.array(Publication),
  volunteer: z.array(Volunteer),
  links: z.array(Link),

  /** Fields we looked for and found nothing. */
  missing: z.array(z.enum(FIELD_KEYS)),
  /** Aggregate confidence 0..1 across populated fields. */
  confidence: z.number().min(0).max(1),
  /** Populated fields / total fields. */
  coverage: z.object({ populated: z.number(), total: z.number() }),
  /** Whether any contributing provider is synthetic (demo). */
  synthetic: z.boolean(),

  providers: z.array(ProviderRun),
  /** When the merge was produced. */
  generatedAt: z.string(),
  /** Exaggeration heuristic, 0 = reads real, 100 = full LARP. Arbitrary and disclosed. */
  larp: LarpScore,
});
export type Profile = z.infer<typeof Profile>;

/** Wire envelope for /api/profile and cache entries. */
export const ProfileEnvelope = z.object({
  profile: Profile,
  cache: z.object({
    hit: z.boolean(),
    cachedAt: z.string().optional(),
    expiresAt: z.string().optional(),
    ttlSeconds: z.number(),
  }),
});
export type ProfileEnvelope = z.infer<typeof ProfileEnvelope>;
