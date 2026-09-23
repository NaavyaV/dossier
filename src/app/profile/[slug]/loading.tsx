import { SearchForm } from "@/components/SearchForm";
import { TopBar } from "@/components/ui";

/** Skeleton mirroring the dossier layout so the page doesn't reflow on arrival. */
export default function Loading() {
  return (
    <>
      <TopBar>
        <div className="max-w-md">
          <SearchForm size="sm" />
        </div>
      </TopBar>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8" aria-busy="true" aria-label="Assembling dossier">
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-12 sheet p-5 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8 flex gap-5">
                <div className="skeleton size-20 sm:size-28 shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="skeleton h-3 w-40" />
                  <div className="skeleton h-9 w-2/3" />
                  <div className="skeleton h-4 w-3/4" />
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="skeleton h-10" />
                    <div className="skeleton h-10" />
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 lg:border-l lg:border-rule lg:pl-6 grid grid-cols-3 lg:grid-cols-1 gap-4">
                <div className="skeleton h-12" />
                <div className="skeleton h-12" />
                <div className="skeleton h-12" />
              </div>
            </div>
          </div>
          <div className="lg:col-span-8 space-y-5">
            <div className="sheet p-6 space-y-3">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-11/12" />
              <div className="skeleton h-3 w-2/3" />
            </div>
            <div className="sheet p-6 space-y-6">
              <div className="skeleton h-4 w-32" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-4">
                  <div className="skeleton size-2.5 rounded-full mt-1.5" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-1/2" />
                    <div className="skeleton h-3 w-1/3" />
                    <div className="skeleton h-3 w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <aside className="lg:col-span-4 space-y-5">
            <div className="sheet p-4 space-y-2">
              <div className="skeleton h-3 w-24 mb-3" />
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} className="skeleton h-6" />
              ))}
            </div>
          </aside>
        </div>
        <p className="mt-6 text-center data text-ink-3">consulting sources…</p>
      </main>
    </>
  );
}
