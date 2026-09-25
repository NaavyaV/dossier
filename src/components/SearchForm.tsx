"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { parseLinkedInUrl } from "@/lib/linkedin/url";

type Props = {
  size?: "lg" | "sm";
  defaultValue?: string;
  autoFocus?: boolean;
  disabled?: boolean;
};

export function SearchForm({ size = "lg", defaultValue = "", autoFocus = false, disabled = false }: Props) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (disabled) return;
    const r = parseLinkedInUrl(value);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    setError(null);
    start(() => router.push(`/profile/${encodeURIComponent(r.value.slug)}`));
  }

  const lg = size === "lg";

  return (
    <form onSubmit={submit} noValidate className="relative w-full">
      <label htmlFor={id} className="sr-only">
        LinkedIn profile URL
      </label>
      <div
        className={`flex items-center overflow-hidden rounded-lg border bg-sheet transition-shadow focus-within:shadow-lift ${
          error ? "border-low" : "border-rule-2 focus-within:border-accent"
        } ${lg ? "h-12" : "h-10"}`}
      >
        <span className={`flex shrink-0 items-center gap-1.5 border-r border-rule bg-paper text-ink-3 select-none ${lg ? "h-full px-3 text-[14px]" : "h-full px-2.5 text-[13px]"}`}>
          <LinkedInMark className={lg ? "size-4" : "size-3.5"} />
          <span className="hidden sm:inline">linkedin.com/in/</span>
        </span>
        <input
          id={id}
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={disabled}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder={lg ? "paste a profile URL or handle" : "profile URL or handle"}
          className={`min-w-0 flex-1 bg-transparent px-3 text-ink placeholder:text-ink-3 outline-none ${lg ? "text-[16px]" : "text-[14px]"}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        <button
          type="submit"
          disabled={pending || disabled}
          className={`mr-1 inline-flex shrink-0 items-center justify-center rounded-md bg-ink font-medium text-white transition-colors hover:bg-accent disabled:opacity-60 ${
            lg ? "h-9 px-4 text-[14px]" : "h-8 px-3 text-[13px]"
          }`}
        >
          {pending ? "Opening…" : "Search"}
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="absolute left-0 top-full z-10 mt-1 text-[13px] text-low">
          {error}
        </p>
      )}
    </form>
  );
}

function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#0A66C2"
        d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z"
      />
    </svg>
  );
}
