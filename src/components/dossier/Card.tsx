import type { Profile } from "@/lib/schema/profile";
import { fmtRange, initials } from "@/lib/format";

const VERDICT: Record<Profile["larp"]["verdict"], { label: string; text: string; bar: string }> = {
  grounded: { label: "Real", text: "text-ok", bar: "bg-ok" },
  polished: { label: "A bit staged", text: "text-ink", bar: "bg-ink" },
  inflated: { label: "Inflated", text: "text-mid", bar: "bg-mid" },
  "full-larp": { label: "Full LARP", text: "text-low", bar: "bg-low" },
};

/** One card, meant to be screenshotted. */
export function ProfileCard({ profile }: { profile: Profile }) {
  const name = profile.fullName?.value ?? profile.slug;
  const role = profile.currentRole?.value;
  const roleLine = [role?.title, role?.company].filter(Boolean).join(" · ") || profile.headline?.value;
  const tone = VERDICT[profile.larp.verdict];
  const reasons = profile.larp.signals.filter((s) => s.id !== "base").slice(0, 4);
  const jobs = profile.experience.slice(0, 4);
  const schools = profile.education.slice(0, 2);

  return (
    <article className="sheet mx-auto w-full max-w-md overflow-hidden">
      <div className="px-6 pt-7 pb-6 text-center">
        <Photo url={profile.photoUrl?.value} name={name} />
        <h1 className="display mt-4 text-[1.75rem] text-ink">{name}</h1>
        {roleLine && <p className="mt-1 text-[15px] leading-6 text-ink-2">{roleLine}</p>}

        <p className={`display mt-6 text-[5.5rem] leading-none tabular-nums ${tone.text}`}>
          {profile.larp.percent}
          <span className="text-[0.38em]">% LARP</span>
        </p>
        <p className={`mt-1 text-[15px] font-semibold ${tone.text}`}>{tone.label}</p>
        <p className="mt-1 text-[15px] text-ink-2">{profile.larp.line}</p>

        <div className="mx-auto mt-5 h-2 max-w-[16rem] rounded-full bg-paper-2" role="meter" aria-valuenow={profile.larp.percent} aria-valuemin={0} aria-valuemax={100} aria-label="LARP score">
          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${profile.larp.percent}%` }} />
        </div>

        {reasons.length > 0 && (
          <ul className="mt-5 flex flex-wrap justify-center gap-1.5">
            {reasons.map((s) => (
              <li key={s.id} className="rounded-full bg-paper px-2.5 py-1 text-[13px] text-ink-2">
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {(jobs.length > 0 || schools.length > 0) && (
        <div className="border-t border-rule px-6 py-5 text-left">
          {jobs.length > 0 && (
            <ul className="space-y-3">
              {jobs.map((job) => (
                <li key={job.id}>
                  <div className="text-[15px] font-medium text-ink">{job.title ?? job.company}</div>
                  <div className="text-[13px] text-ink-2">
                    {[job.title ? job.company : null, fmtRange(job.start, job.end, job.current)].filter(Boolean).join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {schools.length > 0 && (
            <ul className={`space-y-2 ${jobs.length ? "mt-4 border-t border-rule pt-4" : ""}`}>
              {schools.map((school) => (
                <li key={school.id} className="text-[14px] text-ink-2">
                  <span className="font-medium text-ink">{school.school}</span>
                  {school.degree ? ` · ${school.degree}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="border-t border-rule px-6 py-3 text-center text-[12px] text-ink-3">
        {profile.synthetic ? "Sample · " : ""}
        is it real or is it larp?
      </div>
    </article>
  );
}

function Photo({ url, name }: { url?: string; name: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" width={96} height={96} referrerPolicy="no-referrer" className="mx-auto size-24 rounded-full object-cover" />
    );
  }
  return (
    <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-paper text-[28px] font-semibold text-ink-3" aria-hidden>
      {initials(name)}
    </div>
  );
}
