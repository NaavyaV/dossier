import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { DossierHeader } from "@/components/dossier/Header";
import { LarpScoreCard } from "@/components/dossier/LarpScore";
import { Ledger, SourcesPanel } from "@/components/dossier/Ledger";
import {
  About,
  CertificationsSection,
  EducationSection,
  ExperienceSection,
  LinksSection,
  MissingSection,
  ProjectsSection,
  PublicationsSection,
  SkillsSection,
  VolunteerSection,
} from "@/components/dossier/Sections";
import { Badge, Eyebrow, TopBar } from "@/components/ui";
import { toAppError, type AppError } from "@/lib/errors";
import { parseLinkedInUrl } from "@/lib/linkedin/url";
import { getProfile, type GetProfileResult } from "@/lib/service/getProfile";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${decodeURIComponent(slug)}`, robots: { index: false } };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ refresh?: string }>;
}) {
  const { slug: rawSlug } = await params;
  const { refresh } = await searchParams;
  const slug = decodeURIComponent(rawSlug);

  let result: GetProfileResult | null = null;
  let error: AppError | null = null;
  try {
    result = await getProfile(slug, { refresh: refresh === "1", headers: await headers() });
  } catch (e) {
    error = toAppError(e);
    if (error.code === "INTERNAL") console.error("[profile page]", e);
  }

  const parsed = parseLinkedInUrl(slug);
  const canonical = parsed.ok ? parsed.value.canonicalUrl : `https://www.linkedin.com/in/${encodeURIComponent(slug)}`;

  return (
    <>
      <TopBar>
        <div className="max-w-md">
          <SearchForm size="sm" />
        </div>
      </TopBar>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        {error || !result ? (
          <ErrorState error={error ?? toAppError(new Error("empty"))} slug={slug} canonical={canonical} />
        ) : (
          <Dossier result={result} />
        )}
      </main>
      <footer className="border-t border-rule">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 text-[12px] text-ink-3 flex flex-wrap justify-between gap-2">
          <span>Public and licensed data only. The LARP score is a heuristic. Not affiliated with LinkedIn.</span>
          <Link href={`/profile/${encodeURIComponent(slug)}?refresh=1`} className="hover:text-ink" prefetch={false}>
            Refresh from sources
          </Link>
        </div>
      </footer>
    </>
  );
}

function Dossier({ result }: { result: GetProfileResult }) {
  const { profile, cache } = result;
  const apiHref = `/api/profile?url=${encodeURIComponent(profile.slug)}`;
  let i = 1;
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-12 space-y-5">
        <LarpScoreCard larp={profile.larp} />
        <DossierHeader profile={profile} cache={cache} />
      </div>
      <div className="lg:col-span-8 space-y-5 min-w-0">
        <About profile={profile} i={i++} />
        <ExperienceSection profile={profile} i={i++} />
        <EducationSection profile={profile} i={i++} />
        <SkillsSection profile={profile} i={i++} />
        <CertificationsSection profile={profile} i={i++} />
        <ProjectsSection profile={profile} i={i++} />
        <PublicationsSection profile={profile} i={i++} />
        <VolunteerSection profile={profile} i={i++} />
        <LinksSection profile={profile} i={i++} />
        <MissingSection profile={profile} i={i++} />
      </div>
      <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-20 lg:self-start rise" style={{ "--i": 2 } as React.CSSProperties}>
        <Ledger profile={profile} />
        <SourcesPanel profile={profile} apiHref={apiHref} />
      </aside>
    </div>
  );
}

const ERROR_COPY: Record<AppError["code"], { title: string; hint: string }> = {
  INVALID_INPUT: { title: "That isn't a profile handle we can look up", hint: "Paste a URL like linkedin.com/in/handle, or just the handle." },
  RATE_LIMITED: { title: "Too many lookups from your network", hint: "Wait a moment and try again. Cached profiles are always available." },
  NOT_FOUND: { title: "No public record for this handle", hint: "Wikidata has no entry for this LinkedIn ID. Set APIFY_TOKEN to pull the profile through Apify." },
  NO_PROVIDERS: { title: "No data sources are configured", hint: "Set APIFY_TOKEN as a Worker secret. The token is on Apify Console → Settings → API & Integrations." },
  UPSTREAM_ERROR: { title: "Sources didn't respond", hint: "One or more providers failed or timed out. Try again shortly." },
  TIMEOUT: { title: "Sources took too long", hint: "Try again shortly." },
  INTERNAL: { title: "Something went wrong", hint: "The error has been logged. Try again, or try a different handle." },
};

function ErrorState({ error, slug, canonical }: { error: AppError; slug: string; canonical: string }) {
  const copy = ERROR_COPY[error.code];
  const providers = (error.details?.providers as { provider: string; status: string; note?: string }[] | undefined) ?? [];
  return (
    <div className="mx-auto max-w-2xl py-10 sm:py-16">
      <Eyebrow className="mb-3">
        <a href={canonical} target="_blank" rel="noreferrer" className="hover:text-ink">
          linkedin.com/in/{slug}
        </a>
      </Eyebrow>
      <div className="flex items-start gap-3">
        <h1 className="display text-[clamp(1.5rem,3.5vw,2.25rem)] text-ink">{copy.title}</h1>
        <Badge tone={error.code === "NOT_FOUND" ? "neutral" : error.code === "RATE_LIMITED" ? "mid" : "low"}>{error.code.replace("_", " ")}</Badge>
      </div>
      <p className="mt-3 text-[15px] leading-6 text-ink-2">{error.message}</p>
      <p className="mt-1 text-[14px] leading-6 text-ink-3">{copy.hint}</p>
      {error.retryAfterSeconds ? <p className="mt-2 data text-ink-3">Retry after {error.retryAfterSeconds}s</p> : null}

      {providers.length > 0 && (
        <div className="sheet mt-8 p-4">
          <Eyebrow className="mb-2">What each source said</Eyebrow>
          <ul className="divide-y divide-rule text-[13px]">
            {providers.map((p) => (
              <li key={p.provider} className="py-2 flex items-start justify-between gap-4">
                <div>
                  <span className="data text-ink">{p.provider}</span>
                  {p.note && <div className="text-ink-2 mt-0.5">{p.note}</div>}
                </div>
                <Badge tone={p.status === "empty" ? "neutral" : p.status === "skipped" ? "neutral" : "low"}>{p.status}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-4 text-[14px]">
        <Link href="/" className="text-accent-ink hover:underline">
          ← Search another profile
        </Link>
        <Link href="/profile/demo" className="text-ink-2 hover:text-ink">
          See the sample profile
        </Link>
      </div>
    </div>
  );
}
