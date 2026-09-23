"use client";

import { useEffect, useState } from "react";
import { SearchForm } from "@/components/SearchForm";
import { TopBar } from "@/components/ui";

const STEPS = [
  "Looking through this...",
  "Checking LinkedIn...",
  "Reading the headline...",
  "Checking the jobs...",
  "Counting the buzzwords...",
  "Looking at the About...",
  "Skimming the skills...",
  "Checking Wikidata...",
  "Comparing the roles...",
  "Calculating LARP score...",
];

export default function Loading() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((current) => (current + 1) % STEPS.length);
    }, 1600);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <TopBar>
        <SearchForm size="sm" />
      </TopBar>
      <main className="flex flex-1 justify-center px-4 py-8 sm:py-12" aria-busy="true" aria-live="polite" aria-label="Scoring profile">
        <article className="sheet mx-auto w-full max-w-md px-6 pb-8 pt-7 text-center">
          <div className="skeleton mx-auto size-24 rounded-full" />
          <div className="skeleton mx-auto mt-4 h-7 w-40" />
          <div className="skeleton mx-auto mt-2 h-4 w-56" />
          <p className="display mt-8 text-[1.35rem] text-ink">{STEPS[step]}</p>
        </article>
      </main>
    </>
  );
}
