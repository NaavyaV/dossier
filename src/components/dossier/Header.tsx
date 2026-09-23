import type { Profile, ProfileEnvelope, Provenance } from "@/lib/schema/profile";
import { FIELD_KEYS, FIELD_LABELS } from "@/lib/schema/profile";
import { NETWORK_LABEL, fmtDateTime, hostOf, initials, relativeTime, untilTime } from "@/lib/format";
import { ConfidenceMeter, Eyebrow, SourceChips } from "@/components/ui";
import { Conflicts } from "./Conflicts";

export function DossierHeader({ profile, cache }: { profile: Profile; cache: ProfileEnvelope["cache"] }) {
  const name = profile.fullName?.value ?? profile.slug;
  const role = profile.currentRole?.value;
  const roleText = role ? [role.title, role.company].filter(Boolean).join(" · ") : undefined;
  const okSources = profile.providers.filter((p) => p.status === "ok");
  const freshest = okSources.map((p) => p.observedAt).filter(Boolean).sort().at(-1);

  return (
    <section className="sheet rise p-5 sm:p-6" style={{ "--i": 0 } as React.CSSProperties}>
      {profile.synthetic && (
        <div className="mb-4 -mt-1 flex items-center gap-2 rounded-md bg-mid-soft px-3 py-2 text-[13px] text-mid">
          <span className="font-medium">Sample data.</span> Fictional person, here so you can see the score and the layout.
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Identity */}
        <div className="lg:col-span-8 flex gap-5">
          <Photo url={profile.photoUrl?.value} name={name} />
          <div className="min-w-0 flex-1">
            <Eyebrow className="mb-1.5">
              <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="hover:text-ink">
                linkedin.com/in/{profile.slug}
              </a>
            </Eyebrow>
            <h1 className="display text-[clamp(1.75rem,4vw,2.5rem)] text-ink break-words">{name}</h1>
            {profile.fullName?.conflicts?.length ? <Conflicts field={profile.fullName} render={(v) => v} /> : null}

            {profile.headline ? (
              <p className="mt-2 text-[16px] leading-6 text-ink-2">{profile.headline.value}</p>
            ) : (
              <Missing label="headline" />
            )}
            {profile.headline?.conflicts?.length ? <Conflicts field={profile.headline} render={(v) => v} /> : null}

            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Fact
                label="Current role"
                field={profile.currentRole}
                value={roleText}
                conflicts={profile.currentRole?.conflicts?.map((c) => ({ value: [c.value.title, c.value.company].filter(Boolean).join(" · "), source: c.source }))}
              />
              <Fact label="Location" field={profile.location} value={profile.location?.value} conflicts={profile.location?.conflicts} />
            </dl>

            {profile.links.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {profile.links.slice(0, 8).map((l) => (
                  <a
                    key={l.id}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-paper px-2 py-1 text-[12px] text-ink-2 hover:border-rule-2 hover:text-ink no-underline"
                    title={`${l.url}\nvia ${l.sources.map((s) => s.label).join(", ")}`}
                  >
                    <span className="font-medium">{NETWORK_LABEL[l.network] ?? l.network}</span>
                    <span className="data text-ink-3 truncate max-w-[10rem]">{l.handle ? `@${l.handle}` : hostOf(l.url)}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Readout */}
        <div className="lg:col-span-4 lg:border-l lg:border-rule lg:pl-6 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4 content-start">
          <Stat label="Coverage">
            <div className="flex items-baseline gap-1.5">
              <span className="display text-[26px] text-ink tabular-nums">{profile.coverage.populated}</span>
              <span className="data text-ink-3">/ {profile.coverage.total} fields</span>
            </div>
            <CoverageStrip profile={profile} />
          </Stat>
          <Stat label="Confidence">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="display text-[26px] text-ink tabular-nums">{profile.confidence.toFixed(2)}</span>
              <ConfidenceMeter value={profile.confidence} label={false} size="md" />
            </div>
            <div className="text-[11px] text-ink-3 mt-1">mean over populated fields</div>
          </Stat>
          <Stat label="Freshness">
            <div className="display text-[26px] text-ink tabular-nums">{freshest ? relativeTime(freshest) : "—"}</div>
            <div className="text-[11px] text-ink-3 mt-1 leading-4">
              {okSources.length} source{okSources.length === 1 ? "" : "s"} · {cache.hit ? `cached ${relativeTime(cache.cachedAt!)}` : "assembled just now"}
              {cache.expiresAt && <span title={`Expires ${fmtDateTime(cache.expiresAt)}`}> · refreshes in {untilTime(cache.expiresAt)}</span>}
            </div>
          </Stat>
        </div>
      </div>
    </section>
  );
}

function Photo({ url, name }: { url?: string; name: string }) {
  return (
    <div className="shrink-0">
      {url ? (
        // Plain <img>: provider-hosted, many origins, no optimizer on Workers.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Photo of ${name}`}
          width={112}
          height={112}
          referrerPolicy="no-referrer"
          className="size-20 sm:size-28 rounded-lg object-cover bg-paper-2 border border-rule"
        />
      ) : (
        <div
          className="size-20 sm:size-28 rounded-lg border border-dashed border-rule-2 bg-paper flex flex-col items-center justify-center text-center"
          aria-label="No photo available"
        >
          <span className="display text-[22px] text-ink-3">{initials(name)}</span>
          <span className="eyebrow mt-1 text-[9px]">no photo</span>
        </div>
      )}
    </div>
  );
}

function Fact({
  label,
  field,
  value,
  conflicts,
}: {
  label: string;
  field: { sources: Provenance[]; confidence: number } | null;
  value?: string;
  conflicts?: { value: string; source: Provenance }[];
}) {
  return (
    <div>
      <dt className="text-[11px] text-ink-3">{label}</dt>
      <dd className="mt-0.5">
        {field && value ? (
          <>
            <div className="text-[14px] font-medium text-ink">{value}</div>
            <div className="mt-1">
              <SourceChips sources={field.sources} max={2} />
            </div>
            {conflicts?.length ? <Conflicts field={{ value, sources: field.sources, confidence: field.confidence, conflicts }} render={(v) => v} /> : null}
          </>
        ) : (
          <Missing label={label.toLowerCase()} />
        )}
      </dd>
    </div>
  );
}

export function Missing({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-[13px] text-ink-3">
      <span className="inline-block size-2 rounded-full border border-rule-2" aria-hidden />
      No {label} in any source
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Eyebrow className="mb-1">{label}</Eyebrow>
      {children}
    </div>
  );
}

/** Fourteen cells, one per schema field, filled when populated. The ledger in miniature. */
function CoverageStrip({ profile }: { profile: Profile }) {
  const missing = new Set(profile.missing);
  return (
    <div className="mt-2 flex gap-[3px]" aria-hidden>
      {FIELD_KEYS.map((k) => (
        <span
          key={k}
          title={`${FIELD_LABELS[k]}: ${missing.has(k) ? "missing" : "present"}`}
          className={`h-2 flex-1 rounded-[1px] ${missing.has(k) ? "bg-rule" : "bg-ink"}`}
        />
      ))}
    </div>
  );
}

