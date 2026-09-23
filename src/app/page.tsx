import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { TopBar } from "@/components/ui";

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
        <div className="mt-8 w-full max-w-xl">
          <SearchForm size="lg" autoFocus />
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
