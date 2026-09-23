"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex-1 mx-auto w-full max-w-2xl px-4 sm:px-6 py-24">
      <div className="eyebrow mb-3">Unexpected error</div>
      <h1 className="display text-[2rem] text-ink">Something broke while rendering this page</h1>
      <p className="mt-3 text-[15px] text-ink-2">The error has been logged{error.digest ? ` (ref ${error.digest})` : ""}. You can retry, or head back to search.</p>
      <div className="mt-6 flex gap-4 text-[14px]">
        <button onClick={reset} className="rounded-md bg-ink px-4 py-2 font-medium text-white hover:bg-accent">
          Try again
        </button>
        <Link href="/" className="inline-flex items-center text-accent-ink hover:underline">
          ← Back to search
        </Link>
      </div>
    </main>
  );
}
