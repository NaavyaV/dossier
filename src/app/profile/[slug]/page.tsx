import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { ProfileCard } from "@/components/dossier/Card";
import { TopBar } from "@/components/ui";
import { toAppError, type AppError } from "@/lib/errors";
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

  return (
    <>
      <TopBar>
        <SearchForm size="sm" />
      </TopBar>
      <main className="flex flex-1 justify-center px-4 py-8 sm:py-12">
        {error || !result ? (
          <ErrorState error={error ?? toAppError(new Error("empty"))} />
        ) : (
          <ProfileCard profile={result.profile} />
        )}
      </main>
    </>
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

function ErrorState({ error }: { error: AppError }) {
  const copy = ERROR_COPY[error.code];
  return (
    <div className="mx-auto max-w-md pt-16 text-center">
      <h1 className="display text-[2rem] text-ink">{copy.title}</h1>
      <p className="mt-3 text-[15px] leading-6 text-ink-2">{copy.hint}</p>
      <Link href="/" className="mt-6 inline-block text-[15px] text-ink hover:underline">
        Try another profile
      </Link>
    </div>
  );
}
