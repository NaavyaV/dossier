import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { Badge, Eyebrow, TopBar } from "@/components/ui";
import { getRuntimeEnv } from "@/lib/infra/env";
import { buildProviders } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

const EXAMPLES = [
  { slug: "demo", label: "demo", note: "grounded sample" },
  { slug: "larp", label: "larp", note: "full costume" },
  { slug: "satyanadella", label: "satyanadella", note: "open data" },
  { slug: "williamhgates", label: "williamhgates", note: "open data" },
];

export default function HomePage() {
  const env = getRuntimeEnv();
  const providers = buildProviders(env);

  return (
    <>
      <TopBar />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-8 items-start">
            <div className="lg:col-span-7">
              <Eyebrow className="mb-4">LARP detector</Eyebrow>
              <h1 className="display text-[clamp(2.6rem,5.4vw,4.25rem)] text-ink">
                is it real
                <br />
                or is it larp?
              </h1>
              <p className="mt-5 max-w-xl text-[17px] leading-7 text-ink-2">
                Paste a public LinkedIn URL. You get the profile, sourced, and a score from 0% to 100% for how staged the
                public text reads. Buzzwords and theater titles push it up. Specifics pull it down.
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

            <aside className="lg:col-span-5 lg:pl-6">
              <div className="sheet p-5 sm:p-6">
                <Eyebrow className="mb-1">What a score looks like</Eyebrow>
                <div className="mt-2 flex items-end gap-3">
                  <p className="display text-[5rem] leading-none text-low tabular-nums">
                    86<span className="text-[0.42em]">%</span>
                  </p>
                  <p className="mb-3 text-[15px] font-semibold text-low">Full LARP</p>
                </div>
                <div className="mt-1 h-3 rounded-full bg-paper-2" aria-hidden>
                  <div className="h-full w-[86%] rounded-full bg-low" />
                </div>
                <ul className="mt-4 space-y-1.5 text-[13px] text-ink-2">
                  <li className="flex justify-between gap-3"><span>Headline buzzwords</span><span className="data text-low">+20</span></li>
                  <li className="flex justify-between gap-3"><span>Three founder titles at once</span><span className="data text-low">+14</span></li>
                  <li className="flex justify-between gap-3"><span>Eight years in one role</span><span className="data text-ok">−10</span></li>
                </ul>
                <p className="mt-4 text-[12px] leading-5 text-ink-3">
                  Illustrative. A real score is computed from the profile, and every field still carries its source, when it was observed, and how sure.
                </p>
              </div>
            </aside>
          </div>
        </section>

        {/* How it's assembled — a real pipeline, so the sequence numbering carries meaning */}
        <section id="how" className="border-y border-rule bg-sheet">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
            <Eyebrow className="mb-6">How a score is assembled</Eyebrow>
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
          <p>Public and licensed data only. The score is a heuristic, not a verdict on the person. Not affiliated with LinkedIn.</p>
          <p className="data">
            GET /api/profile?url=&lt;linkedin url&gt;
          </p>
        </div>
      </footer>
    </>
  );
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

