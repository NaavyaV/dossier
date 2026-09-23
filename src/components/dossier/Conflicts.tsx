import type { Field } from "@/lib/schema/profile";
import { SourceChip } from "@/components/ui";

/** Disclosure listing values other sources reported for the same field. */
export function Conflicts<T>({ field, render }: { field: Field<T>; render: (v: T) => string }) {
  if (!field.conflicts?.length) return null;
  const n = field.conflicts.length;
  return (
    <details className="mt-1.5 group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[11px] text-mid hover:text-ink select-none">
        <span className="inline-block size-1.5 rounded-full bg-mid" aria-hidden />
        {n} other source{n > 1 ? "s" : ""} disagree{n === 1 ? "s" : ""}
        <span className="text-ink-3 group-open:rotate-90 transition-transform" aria-hidden>
          ›
        </span>
      </summary>
      <ul className="mt-1.5 space-y-1.5 border-l-2 border-mid-soft pl-3">
        {field.conflicts.map((c, i) => (
          <li key={i} className="text-[13px] text-ink-2">
            <div>{render(c.value)}</div>
            <div className="mt-0.5">
              <SourceChip source={c.source} />
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
