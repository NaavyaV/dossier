import Link from "next/link";
import type { Profile, ProviderRun } from "@/lib/schema/profile";
import { FIELD_KEYS, FIELD_LABELS, type FieldKey } from "@/lib/schema/profile";
import { fmtDateTime, relativeTime } from "@/lib/format";
import { Badge, ConfidenceMeter, Eyebrow } from "@/components/ui";

/**
 * The field ledger: every schema field, present or missing, with its confidence.
 * Doubles as in-page navigation. This is the dossier's signature element —
 * completeness made visible.
 */

const ANCHORS: Partial<Record<FieldKey, string>> = {
  about: "about",
  experience: "experience",
  education: "education",
  skills: "skills",
  certifications: "certifications",
  projects: "projects",
  publications: "publications",
  volunteer: "volunteer",
  links: "links",
};

function fieldConfidence(profile: Profile, k: FieldKey): number | null {
  switch (k) {
    case "fullName":
    case "photoUrl":
    case "headline":
    case "location":
    case "currentRole":
    case "about":
      return profile[k]?.confidence ?? null;
    default: {
      const arr = profile[k];
      if (!arr.length) return null;
      if (k === "links" && !arr.some((l) => l.sources.some((s) => s.provider !== "input"))) return null;
      return arr.reduce((s, x) => s + x.confidence, 0) / arr.length;
    }
  }
}

function fieldCount(profile: Profile, k: FieldKey): number | undefined {
  const v = profile[k];
  return Array.isArray(v) ? v.length : undefined;
}

export function Ledger({ profile }: { profile: Profile }) {
  return (
    <nav aria-label="Field ledger" className="sheet p-4">
      <div className="flex items-baseline justify-between mb-3">
        <Eyebrow>Field ledger</Eyebrow>
        <span className="data text-ink-3">
          {profile.coverage.populated}/{profile.coverage.total}
        </span>
      </div>
      <ol className="space-y-[2px]">
        {FIELD_KEYS.map((k) => {
          const conf = fieldConfidence(profile, k);
          const present = conf !== null;
          const count = present ? fieldCount(profile, k) : undefined;
          const anchor = ANCHORS[k];
          const row = (
            <>
              <span
                className={`inline-block size-2 rounded-full shrink-0 ${present ? "bg-ink" : "border border-rule-2"}`}
                aria-hidden
              />
              <span className={`flex-1 truncate ${present ? "text-ink" : "text-ink-3"}`}>{FIELD_LABELS[k]}</span>
              {count !== undefined && <span className="data text-ink-3">{count}</span>}
              {present ? <ConfidenceMeter value={conf} /> : <span className="data text-ink-3">missing</span>}
            </>
          );
          const cls = "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px]";
          return (
            <li key={k}>
              {present && anchor ? (
                <a href={`#${anchor}`} className={`${cls} hover:bg-paper no-underline`}>
                  {row}
                </a>
              ) : (
                <div className={cls}>{row}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const STATUS_TONE: Record<ProviderRun["status"], { label: string; tone: "ok" | "mid" | "low" | "neutral" }> = {
  ok: { label: "Contributed", tone: "ok" },
  empty: { label: "No record", tone: "neutral" },
  unavailable: { label: "Unavailable", tone: "mid" },
  error: { label: "Error", tone: "low" },
  skipped: { label: "Not run", tone: "neutral" },
};

export function SourcesPanel({ profile, apiHref }: { profile: Profile; apiHref: string }) {
  return (
    <section className="sheet p-4" aria-labelledby="sources-heading">
      <div className="flex items-baseline justify-between mb-3">
        <Eyebrow>
          <span id="sources-heading">Sources consulted</span>
        </Eyebrow>
        <span className="data text-ink-3">{profile.providers.length}</span>
      </div>
      <ul className="divide-y divide-rule">
        {profile.providers.map((r) => {
          const st = STATUS_TONE[r.status];
          return (
            <li key={r.provider} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-ink truncate">
                    {r.sourceUrl ? (
                      <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                        {r.label}
                      </a>
                    ) : (
                      r.label
                    )}
                  </div>
                  <div className="data text-ink-3 mt-0.5 flex flex-wrap gap-x-2">
                    {r.observedAt && r.status === "ok" && <span title={fmtDateTime(r.observedAt)}>observed {relativeTime(r.observedAt)}</span>}
                    {r.durationMs > 0 && <span>{r.durationMs} ms</span>}
                  </div>
                  {r.note && <div className="text-[12px] text-ink-2 mt-1 leading-4">{r.note}</div>}
                  {r.fieldsContributed?.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.fieldsContributed.map((f) => (
                        <span key={f} className="data rounded bg-paper px-1 text-ink-3">
                          {f}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {r.license && <div className="text-[11px] text-ink-3 mt-1">{r.license}</div>}
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="hairline-t mt-3 pt-3 flex items-center justify-between text-[12px]">
        <span className="text-ink-3">Generated {relativeTime(profile.generatedAt)}</span>
        <Link href={apiHref} className="data text-accent-ink hover:underline" prefetch={false}>
          JSON ↗
        </Link>
      </div>
    </section>
  );
}
