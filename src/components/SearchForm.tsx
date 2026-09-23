"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { parseLinkedInUrl } from "@/lib/linkedin/url";

type Props = {
  size?: "lg" | "sm";
  defaultValue?: string;
  autoFocus?: boolean;
};

export function SearchForm({ size = "lg", defaultValue = "", autoFocus = false }: Props) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
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
    <form onSubmit={submit} noValidate className="w-full">
      <label htmlFor={id} className="sr-only">
        LinkedIn profile URL
      </label>
      <div
        className={`flex items-stretch overflow-hidden rounded-lg border bg-sheet transition-shadow focus-within:shadow-lift ${
          error ? "border-low" : "border-rule-2 focus-within:border-accent"
        } ${lg ? "h-14" : "h-9"}`}
      >
        <span
          aria-hidden
          className={`hidden sm:flex items-center border-r border-rule bg-paper px-3 data text-ink-3 select-none ${lg ? "text-[13px]" : "text-[11px]"}`}
        >
          linkedin.com/in/
        </span>
        <input
          id={id}
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder={lg ? "paste a profile URL or handle" : "profile URL or handle"}
          className={`min-w-0 flex-1 bg-transparent px-3 text-ink placeholder:text-ink-3 outline-none ${lg ? "text-[16px]" : "text-[13px]"}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        <button
          type="submit"
          disabled={pending}
          className={`m-1 inline-flex items-center justify-center rounded-md bg-ink px-4 font-medium text-white transition-colors hover:bg-accent disabled:opacity-60 ${
            lg ? "text-[14px]" : "text-[12px] px-3"
          }`}
        >
          {pending ? "Opening…" : "Search"}
        </button>
      </div>
      <div className={`min-h-5 ${lg ? "mt-2" : "mt-1"}`}>
        {error && (
          <p id={`${id}-err`} role="alert" className="text-[13px] text-low">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
