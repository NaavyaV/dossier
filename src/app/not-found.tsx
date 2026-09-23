import Link from "next/link";
import { TopBar } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <TopBar />
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 sm:px-6 py-24">
        <div className="eyebrow mb-3">404</div>
        <h1 className="display text-[2rem] text-ink">There&apos;s nothing at this address</h1>
        <p className="mt-3 text-[15px] text-ink-2">
          Profiles live at <span className="data">/profile/&lt;handle&gt;</span>.
        </p>
        <Link href="/" className="mt-6 inline-block text-[14px] text-accent-ink hover:underline">
          ← Back to search
        </Link>
      </main>
    </>
  );
}
