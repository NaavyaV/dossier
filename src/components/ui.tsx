import Link from "next/link";
import type { Provenance } from "@/lib/schema/profile";
import { confidenceSignal, fmtDateTime, freshnessSignal, relativeTime, type Signal } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Wordmark + top bar                                                  */
/* ------------------------------------------------------------------ */

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-baseline gap-2 no-underline ${className}`} aria-label="Dossier home">
      <span className="display-condensed text-[22px] text-ink">DOSSIER</span>
      <span className="data text-ink-3 hidden sm:inline">v0.1</span>
    </Link>
  );
}

export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Wordmark />
        <div className="flex-1 min-w-0">{children}</div>
        <nav className="hidden md:flex items-center gap-5 text-[13px] text-ink-2">
          <Link href="/#how" className="hover:text-ink">How it works</Link>
          <Link href="/api/health" className="hover:text-ink">API</Link>
          <a href="https://github.com/NaavyaV/dossier" target="_blank" rel="noreferrer" className="hover:text-ink">
            Source
          </a>
        </nav>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Signal-colored bits                                                  */
/* ------------------------------------------------------------------ */

const SIGNAL_TEXT: Record<Signal, string> = { ok: "text-ok", mid: "text-mid", low: "text-low" };
const SIGNAL_BG: Record<Signal, string> = { ok: "bg-ok", mid: "bg-mid", low: "bg-low" };
const SIGNAL_SOFT: Record<Signal, string> = { ok: "bg-ok-soft", mid: "bg-mid-soft", low: "bg-low-soft" };

/** Five-cell confidence meter. Reads as a number, not a vibe. */
export function ConfidenceMeter({ value, label = true, size = "sm" }: { value: number; label?: boolean; size?: "sm" | "md" }) {
  const sig = confidenceSignal(value);
  const filled = Math.round(value * 5);
  const h = size === "md" ? "h-2.5" : "h-1.5";
  const w = size === "md" ? "w-3.5" : "w-2";
  return (
    <span className="inline-flex items-center gap-1.5" title={`Confidence ${value.toFixed(2)}`}>
      <span className="inline-flex gap-[2px]" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={`${h} ${w} rounded-[1px] ${i < filled ? SIGNAL_BG[sig] : "bg-rule-2"}`} />
        ))}
      </span>
      {label && <span className={`data ${SIGNAL_TEXT[sig]}`}>{value.toFixed(2)}</span>}
    </span>
  );
}

/** Provenance chip: who said it, how long ago, how sure. */
export function SourceChip({ source, compact = false }: { source: Provenance; compact?: boolean }) {
  const fresh = freshnessSignal(source.observedAt);
  const conf = confidenceSignal(source.confidence);
  const title = [
    source.label,
    `Observed ${fmtDateTime(source.observedAt)}`,
    `Confidence ${source.confidence.toFixed(2)}`,
    source.license ? `License: ${source.license}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
  const inner = (
    <>
      <span className={`inline-block size-1.5 rounded-full ${SIGNAL_BG[fresh]}`} aria-hidden />
      <span className="truncate min-w-0 max-w-[10rem]">{source.label}</span>
      {!compact && (
        <>
          <span className="text-ink-3">·</span>
          <span className="data text-ink-3">{relativeTime(source.observedAt)}</span>
          <span className={`data ${SIGNAL_TEXT[conf]}`}>{source.confidence.toFixed(2)}</span>
        </>
      )}
    </>
  );
  const cls =
    "inline-flex max-w-full items-center gap-1.5 rounded-full border border-rule bg-sheet px-2 py-[2px] text-[11px] leading-4 text-ink-2 whitespace-nowrap";
  return source.url ? (
    <a href={source.url} target="_blank" rel="noreferrer" title={title} className={`${cls} hover:border-rule-2 hover:text-ink no-underline`}>
      {inner}
    </a>
  ) : (
    <span title={title} className={cls}>
      {inner}
    </span>
  );
}

export function SourceChips({ sources, max = 3 }: { sources: Provenance[]; max?: number }) {
  const shown = sources.slice(0, max);
  const rest = sources.length - shown.length;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map((s) => (
        <SourceChip key={s.provider + s.observedAt} source={s} />
      ))}
      {rest > 0 && <span className="data text-ink-3">+{rest}</span>}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | Signal | "accent" }) {
  const cls =
    tone === "neutral"
      ? "bg-paper-2 text-ink-2"
      : tone === "accent"
        ? "bg-accent-soft text-accent-ink"
        : `${SIGNAL_SOFT[tone]} ${SIGNAL_TEXT[tone]}`;
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded px-1.5 py-[1px] text-[11px] font-medium leading-4 ${cls}`}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Section chrome                                                       */
/* ------------------------------------------------------------------ */

export function SectionHeader({
  id,
  title,
  count,
  right,
}: {
  id: string;
  title: string;
  count?: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 id={id} className="display text-[17px] text-ink flex items-baseline gap-2 scroll-mt-24">
        {title}
        {typeof count === "number" && <span className="data text-ink-3">{count}</span>}
      </h2>
      {right}
    </div>
  );
}

export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`eyebrow ${className}`}>{children}</div>;
}

export function ExternalLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`text-accent-ink hover:underline ${className}`}>
      {children}
    </a>
  );
}
