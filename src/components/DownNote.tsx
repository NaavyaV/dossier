import { PAUSED_MESSAGE } from "@/lib/service/paused";

export function DownNote() {
  return (
    <p className="mx-auto mb-6 max-w-md rounded-lg bg-mid-soft px-4 py-3 text-center text-[15px] leading-6 text-mid">
      {PAUSED_MESSAGE}
    </p>
  );
}
