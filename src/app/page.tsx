import Link from "next/link";
import { DownNote } from "@/components/DownNote";
import { SearchForm } from "@/components/SearchForm";
import { TopBar } from "@/components/ui";
import { SERVICE_PAUSED } from "@/lib/service/paused";

const EXAMPLES = [
  { slug: "larp", label: "Full LARP" },
  { slug: "demo", label: "Pretty real" },
  { slug: "satyanadella", label: "Satya Nadella" },
];

export default function HomePage() {
  return (
    <>
      <TopBar />
      <main className="flex flex-1 flex-col items-center px-4 pb-20 pt-16 sm:pt-28">
        <h1 className="display max-w-xl text-center text-[clamp(2.75rem,8vw,4.5rem)] text-ink">
          is it real
          <br />
          or is it larp?
        </h1>
        {SERVICE_PAUSED ? <div className="mt-8"><DownNote /></div> : null}
        <div className={`w-full max-w-xl ${SERVICE_PAUSED ? "" : "mt-8"}`}>
          <SearchForm size="lg" autoFocus={!SERVICE_PAUSED} disabled={SERVICE_PAUSED} />
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[15px]">
          {EXAMPLES.map((e) => (
            <Link key={e.slug} href={`/profile/${e.slug}`} className="text-ink-2 hover:text-ink">
              {e.label}
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
