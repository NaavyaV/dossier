import { SearchForm } from "@/components/SearchForm";
import { TopBar } from "@/components/ui";

export default function Loading() {
  return (
    <>
      <TopBar>
        <div className="max-w-md">
          <SearchForm size="sm" />
        </div>
      </TopBar>
      <main className="flex flex-1 justify-center px-4 py-8" aria-busy="true" aria-label="Scoring profile">
        <div className="sheet w-full max-w-md p-8 text-center">
          <div className="skeleton mx-auto size-24 rounded-full" />
          <div className="skeleton mx-auto mt-4 h-7 w-40" />
          <div className="skeleton mx-auto mt-2 h-4 w-56" />
          <div className="skeleton mx-auto mt-8 h-20 w-32" />
        </div>
      </main>
    </>
  );
}