"use client";

import { useEffect, useState } from "react";
import { SearchForm } from "@/components/SearchForm";
import { TopBar } from "@/components/ui";

const STEPS = ["Looking through this...", "Checking Apify...", "Checking Wikidata...", "Calculating LARP score..."];

export default function Loading() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((current) => Math.min(current + 1, STEPS.length - 1));
    }, 1600);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <TopBar>
        <SearchForm size="sm" />
      </TopBar>
      <main className="flex flex-1 justify-center px-4 py-16" aria-busy="true" aria-live="polite" aria-label="Scoring profile">
        <ol className="w-full max-w-sm space-y-3">
          {STEPS.map((label, i) => {
            const state = i < step ? "done" : i === step ? "now" : "wait";
            return (
              <li key={label} className={`flex items-center gap-3 text-[16px] ${state === "wait" ? "text-ink-3" : "text-ink"}`}>
                <span
                  className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    state === "done" ? "bg-ink text-white" : state === "now" ? "border border-ink" : "border border-rule-2"
                  }`}
                  aria-hidden
                >
                  {state === "done" ? "✓" : state === "now" ? "•" : ""}
                </span>
                {label}
              </li>
            );
          })}
        </ol>
      </main>
    </>
  );
}