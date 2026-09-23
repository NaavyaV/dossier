import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { Badge, Eyebrow, SourceChip, TopBar } from "@/components/ui";
import { getRuntimeEnv } from "@/lib/infra/env";
import { buildProviders } from "@/lib/providers/registry";
import type { Provenance } from "@/lib/schema/profile";

export const dynamic = "force-dynamic";

const EXAMPLES = [
  { slug: "demo", label: "Sample dossier", note: "fictional person, all fields" },
  { slug: "satyanadella", label: "satyanadella", note: "open data" },
  { slug: "williamhgates", label: "williamhgates", note: "open data" },
];

export default function HomePage() {
  const env = getRuntimeEnv();
  const providers = buildProviders(env);
  const specimen = specimenSources();

  return (
    <>
      <TopBar />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-8 items-start">
            <div className="lg:col-span-7">
              <Eyebrow className="mb-4">Public LinkedIn URL → structured, sourced profile</Eyebrow>
              <h1 className="display text-[clamp(2.4rem,5.2vw,3.75rem)] text-ink">
                One link in.
                <br />
                A sourced dossier out.
              </h1>
              <p className="mt-5 max-w-xl text-[17px] leading-7 text-ink-2">
                Paste a public profile URL. Dossier assembles a structured professional profile from licensed APIs and open
                datasets, resolves duplicates across sources, and labels every field with where it came from and how fresh it
                is.
              </p>
              <div className="mt-8 max-w-2xl">
                <SearchForm size="lg" autoFocus />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-2">
                <span className="text-ink-3">Try</span>
                {EXAMPLES.map((e) => (
                  <Link key={e.slug} href={`/profile/${e.slug}`} className="group inline-flex items-baseline gap-1.5 hover:text-ink">
                    <span className="data text-accent-ink group-hover:underline">{e.label}</span>
                    <span className="text-ink-3">{e.note}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Specimen: teaches the provenance vocabulary before the user sees a dossier */}
            <aside className="lg:col-span-5 lg:pl-6">
              <div className="sheet p-5">
                <Eyebrow className="mb-3">Every field reads like this</Eyebrow>
                <div className="space-y-4">
                  <div>
                    <div className="text-[11px] text-ink-3 mb-1">Current role</div>
                    <div className="text-[15px] font-medium text-ink">Staff Engineer · Meridian</div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {specimen.map((s) => (
                        <SourceChip key={s.provider} source={s} />
                      ))}
                    </div>
                  </div>
                  <div className="hairline-t pt-4">
                    <div className="text-[11px] text-ink-3 mb-1">Certifications</div>
                    <div className="flex items-center gap-2 text-[14px] text-ink-3">
                      <span className="inline-block size-2 rounded-full border border-rule-2" aria-hidden />
                      Not found in any consulted source
                    </div>
                  </div>
                  <div className="hairline-t pt-4 grid grid-cols-3 gap-3">
                    <Legend dot="bg-ok" text="Fresh · ≤ 90 days" />
                    <Legend dot="bg-mid" text="Aging · ≤ 1 year" />
                    <Legend dot="bg-low" text="Stale · > 1 year" />
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* How it's assembled — a real pipeline, so the sequence numbering carries meaning */}
        <section id="how" className="border-y border-rule bg-sheet">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
            <Eyebrow className="mb-6">How a dossier is assembled</Eyebrow>
            <ol className="grid gap-8 md:grid-cols-4">
              <Step n="1" title="Validate">
                The URL is parsed to a canonical handle. Company pages, legacy <span className="data">/pub/</span> links and anything that isn&apos;t a person are refused up
                front.
              </Step>
              <Step n="2" title="Consult sources in parallel">
                Each configured provider is asked once, with a hard timeout. Results are normalised into a single schema — no
                provider shape leaks past its adapter.
              </Step>
              <Step n="3" title="Resolve duplicates">
                Roles, schools, skills and links are matched fuzzily across sources (&ldquo;Stripe&rdquo; ≈ &ldquo;Stripe, Inc.&rdquo;) and unioned
                field by field. Disagreements are kept, not hidden.
              </Step>
              <Step n="4" title="Score and label">
                Agreement raises confidence; age lowers it. Every value ships with its sources, observation time and a score.
                Missing fields are listed, not omitted.
              </Step>
            </ol>
          </div>
        </section>

        {/* Live provider table — reflects the actual deployment config */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <Eyebrow className="mb-2">Sources on this deployment</Eyebrow>
              <p className="text-[14px] text-ink-2 max-w-2xl">
                Only legally obtained data: licensed vendor APIs and openly licensed datasets. Nothing here logs in, sets
                cookies, or reads past an auth wall. Emails and phone numbers are never collected.
              </p>
            </div>
            <Link href="/api/health" className="data text-accent-ink hover:underline whitespace-nowrap">
              /api/health
            </Link>
          </div>
          <div className="sheet overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left eyebrow border-b border-rule">
                  <th className="px-4 py-2.5 font-semibold">Source</th>
                  <th className="px-4 py-2.5 font-semibold hidden sm:table-cell">Phase</th>
                  <th className="px-4 py-2.5 font-semibold hidden md:table-cell">License</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => {
                  const on = p.isEnabled(env);
                  return (
                    <tr key={p.id} className="border-b border-rule last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-ink">{p.label}</div>
                        <div className="data text-ink-3">{p.id}</div>
                      </td>
                      <td className="px-4 py-2.5 text-ink-2 hidden sm:table-cell">{p.phase === "primary" ? "Primary" : "Enrichment"}</td>
                      <td className="px-4 py-2.5 text-ink-2 hidden md:table-cell">{p.license}</td>
                      <td className="px-4 py-2.5 text-right">
                        {on ? <Badge tone="ok">Enabled</Badge> : <Badge>Off · {p.disabledReason?.(env) ?? "disabled"}</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row gap-3 sm:items-center justify-between text-[12px] text-ink-3">
          <p>Dossier reads public and licensed data only. It is not affiliated with LinkedIn.</p>
          <p className="data">
            GET /api/profile?url=&lt;linkedin url&gt;
          </p>
        </div>
      </footer>
    </>
  );
}

/** Illustrative provenance for the hero specimen; computed per request, outside render. */
function specimenSources(): Provenance[] {
  const now = Date.now();
  return [
    { provider: "a", label: "People Data Labs", observedAt: new Date(now).toISOString(), confidence: 0.9, license: "Licensed" },
    { provider: "b", label: "Wikidata", observedAt: new Date(now - 200 * 86_400_000).toISOString(), confidence: 0.72, license: "CC0" },
  ];
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="relative">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="display-condensed text-[28px] text-ink-3 tabular-nums">{n}</span>
        <h3 className="display text-[16px] text-ink">{title}</h3>
      </div>
      <p className="text-[14px] leading-6 text-ink-2">{children}</p>
    </li>
  );
}

function Legend({ dot, text }: { dot: string; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-ink-2">
      <span className={`inline-block size-1.5 rounded-full ${dot}`} aria-hidden />
      {text}
    </div>
  );
}
