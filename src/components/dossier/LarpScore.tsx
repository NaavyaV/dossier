import type { LarpScore as LarpScoreT } from "@/lib/schema/profile";
import { Eyebrow } from "@/components/ui";

const VERDICT_LABEL: Record<LarpScoreT["verdict"], string> = {
  grounded: "Real",
  polished: "A bit staged",
  inflated: "Inflated",
  "full-larp": "Full LARP",
};

const VERDICT_TEXT: Record<LarpScoreT["verdict"], string> = {
  grounded: "text-ok",
  polished: "text-ink",
  inflated: "text-mid",
  "full-larp": "text-low",
};

const VERDICT_FILL: Record<LarpScoreT["verdict"], string> = {
  grounded: "bg-ok",
  polished: "bg-ink",
  inflated: "bg-mid",
  "full-larp": "bg-low",
};

/** The number the page is for. Arbitrary, and it says so. */
export function LarpScoreCard({ larp, i = 0 }: { larp: LarpScoreT; i?: number }) {
  const raised = larp.signals.filter((s) => s.points > 0 && s.id !== "base");
  const lowered = larp.signals.filter((s) => s.points < 0);
  return (
    <section className="sheet rise overflow-hidden" style={{ "--i": i } as React.CSSProperties} aria-labelledby="larp-heading">
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-5">
          <Eyebrow>
            <span id="larp-heading">LARP score</span>
          </Eyebrow>
          <div className="mt-2 flex items-end gap-3">
            <p className={`display text-[clamp(4.5rem,10vw,6.5rem)] leading-none tabular-nums ${VERDICT_TEXT[larp.verdict]}`}>
              {larp.percent}
              <span className="text-[0.42em]">%</span>
            </p>
            <p className={`mb-2 text-[15px] font-semibold ${VERDICT_TEXT[larp.verdict]}`}>{VERDICT_LABEL[larp.verdict]}</p>
          </div>
          <p className="mt-1 max-w-sm text-[15px] text-ink-2">{larp.line}</p>
        </div>
        <div className="lg:col-span-7">
          <div className="mb-2 flex justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
            <span>Real</span>
            <span>LARP</span>
          </div>
          <div className="relative h-3 rounded-full bg-paper-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={larp.percent} aria-label="LARP score">
            <div className={`h-full rounded-full ${VERDICT_FILL[larp.verdict]}`} style={{ width: `${larp.percent}%` }} />
          </div>
          <p className="mt-3 text-[12px] leading-5 text-ink-3">
            An arbitrary read of the public text: buzzwords, theater titles and stacked roles raise it; numbers, long tenure and a second source lower it. It is not a lie detector.
          </p>
        </div>
      </div>
      <div className="grid border-t border-rule sm:grid-cols-2">
        <SignalList title="Pushes it up" items={raised} empty="Nothing theatrical stood out." />
        <SignalList title="Pulls it down" items={lowered} empty="Nothing specific to hold it down." />
      </div>
    </section>
  );
}

function SignalList({ title, items, empty }: { title: string; items: LarpScoreT["signals"]; empty: string }) {
  return (
    <div className="px-5 py-4 sm:px-6 sm:[&:first-child]:border-r sm:border-rule">
      <Eyebrow className="mb-2">{title}</Eyebrow>
      {items.length === 0 ? (
        <p className="text-[13px] text-ink-3">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0">
                <span className="font-medium text-ink">{s.label}</span>
                {s.detail && <span className="text-ink-3"> · {s.detail}</span>}
              </span>
              <span className={`data shrink-0 ${s.points > 0 ? "text-low" : "text-ok"}`}>
                {s.points > 0 ? `+${s.points}` : s.points}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
