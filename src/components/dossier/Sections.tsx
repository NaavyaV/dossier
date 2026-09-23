import type { Profile, Provenance } from "@/lib/schema/profile";
import { FIELD_LABELS, type FieldKey } from "@/lib/schema/profile";
import { NETWORK_LABEL, fmtDuration, fmtPartialDate, fmtRange, hostOf } from "@/lib/format";
import { ConfidenceMeter, ExternalLink, SectionHeader, SourceChips } from "@/components/ui";
import { Conflicts } from "./Conflicts";

type CSS = React.CSSProperties;
const idx = (i: number) => ({ "--i": i } as CSS);

function Card({ id, i, children }: { id?: string; i: number; children: React.ReactNode }) {
  return (
    <section id={id} className="sheet rise p-5 sm:p-6 scroll-mt-24" style={idx(i)}>
      {children}
    </section>
  );
}

/** Best (most confident) provenance across a list — used as the section-level chip. */
function best(sources: Provenance[][]): Provenance[] {
  const seen = new Map<string, Provenance>();
  for (const arr of sources) for (const s of arr) if (!seen.has(s.provider) || seen.get(s.provider)!.confidence < s.confidence) seen.set(s.provider, s);
  return [...seen.values()].sort((a, b) => b.confidence - a.confidence);
}

/* ------------------------------------------------------------------ */

export function About({ profile, i }: { profile: Profile; i: number }) {
  const f = profile.about;
  if (!f) return null;
  return (
    <Card id="about" i={i}>
      <SectionHeader id="about-h" title="About" right={<SourceChips sources={f.sources} />} />
      <p className="whitespace-pre-line text-[15px] leading-7 text-ink max-w-prose">{f.value}</p>
      <Conflicts field={f} render={(v) => v} />
    </Card>
  );
}

export function ExperienceSection({ profile, i }: { profile: Profile; i: number }) {
  const items = profile.experience;
  if (!items.length) return null;
  return (
    <Card id="experience" i={i}>
      <SectionHeader id="experience-h" title="Experience" count={items.length} right={<SourceChips sources={best(items.map((x) => x.sources))} max={2} />} />
      <ol className="relative ml-1 border-l border-rule-2 pl-6 space-y-7">
        {items.map((e) => {
          const range = fmtRange(e.start, e.end, e.current);
          const dur = fmtDuration(e.start, e.end);
          return (
            <li key={e.id} className="relative">
              <span
                className={`absolute -left-[31px] top-[7px] size-[9px] rounded-full border-2 border-sheet ${e.current || (e.start && !e.end) ? "bg-accent" : "bg-ink-3"}`}
                aria-hidden
              />
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-[16px] font-semibold text-ink leading-6">
                  {e.title ?? <span className="text-ink-2 font-medium">Role not specified</span>}
                </h3>
                {range && (
                  <div className="data text-ink-2 whitespace-nowrap">
                    {range}
                    {dur && <span className="text-ink-3"> · {dur}</span>}
                  </div>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[14px] text-ink-2">
                {e.companyLogoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.companyLogoUrl} alt="" width={16} height={16} referrerPolicy="no-referrer" className="size-4 rounded-sm object-contain" />
                )}
                {e.companyUrl ? <ExternalLink href={e.companyUrl} className="text-ink-2 font-medium hover:text-ink">{e.company}</ExternalLink> : <span className="font-medium">{e.company}</span>}
                {e.employmentType && <span className="text-ink-3">· {e.employmentType}</span>}
                {e.location && <span className="text-ink-3">· {e.location}</span>}
              </div>
              {e.description && <p className="mt-2 whitespace-pre-line text-[14px] leading-6 text-ink-2 max-w-prose">{e.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SourceChips sources={e.sources} />
                <ConfidenceMeter value={e.confidence} />
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

export function EducationSection({ profile, i }: { profile: Profile; i: number }) {
  const items = profile.education;
  if (!items.length) return null;
  return (
    <Card id="education" i={i}>
      <SectionHeader id="education-h" title="Education" count={items.length} right={<SourceChips sources={best(items.map((x) => x.sources))} max={2} />} />
      <ul className="divide-y divide-rule">
        {items.map((e) => {
          const range = fmtRange(e.start, e.end, false);
          return (
            <li key={e.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-[15px] font-semibold text-ink">
                  {e.schoolUrl ? <ExternalLink href={e.schoolUrl} className="text-ink hover:text-accent-ink">{e.school}</ExternalLink> : e.school}
                </h3>
                {range && <div className="data text-ink-2">{range}</div>}
              </div>
              {(e.degree || e.field) && <div className="text-[14px] text-ink-2 mt-0.5">{[e.degree, e.field].filter(Boolean).join(" · ")}</div>}
              {e.description && <p className="mt-1.5 text-[14px] leading-6 text-ink-2 max-w-prose">{e.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SourceChips sources={e.sources} />
                <ConfidenceMeter value={e.confidence} />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function SkillsSection({ profile, i }: { profile: Profile; i: number }) {
  const items = profile.skills;
  if (!items.length) return null;
  return (
    <Card id="skills" i={i}>
      <SectionHeader id="skills-h" title="Skills" count={items.length} right={<SourceChips sources={best(items.map((x) => x.sources))} max={2} />} />
      <ul className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <li
            key={s.id}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[13px] ${
              s.sources.length > 1 ? "border-ink/20 bg-sheet text-ink" : "border-rule bg-paper text-ink-2"
            }`}
            title={`${s.name}\nvia ${s.sources.map((x) => x.label).join(", ")}\nconfidence ${s.confidence.toFixed(2)}`}
          >
            {s.name}
            {s.endorsements !== undefined && <span className="data text-ink-3">{s.endorsements}</span>}
            {s.sources.length > 1 && <span className="data text-ok" title="Corroborated by more than one source">×{s.sources.length}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-ink-3">Outlined chips come from a single source; solid chips are corroborated. Numbers are endorsement counts where a source reports them.</p>
    </Card>
  );
}

export function CertificationsSection({ profile, i }: { profile: Profile; i: number }) {
  const items = profile.certifications;
  if (!items.length) return null;
  return (
    <Card id="certifications" i={i}>
      <SectionHeader id="certifications-h" title="Certifications" count={items.length} />
      <ul className="divide-y divide-rule">
        {items.map((c) => (
          <li key={c.id} className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-ink">{c.url ? <ExternalLink href={c.url} className="text-ink hover:text-accent-ink">{c.name}</ExternalLink> : c.name}</div>
              <div className="text-[13px] text-ink-2">
                {c.issuer}
                {c.credentialId && <span className="data text-ink-3"> · {c.credentialId}</span>}
              </div>
              <div className="mt-1.5"><SourceChips sources={c.sources} /></div>
            </div>
            <div className="data text-ink-2 text-right">
              {fmtPartialDate(c.issued) && <div>Issued {fmtPartialDate(c.issued)}</div>}
              {fmtPartialDate(c.expires) && <div className="text-ink-3">Expires {fmtPartialDate(c.expires)}</div>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ProjectsSection({ profile, i }: { profile: Profile; i: number }) {
  const items = profile.projects;
  if (!items.length) return null;
  return (
    <Card id="projects" i={i}>
      <SectionHeader id="projects-h" title="Projects" count={items.length} right={<SourceChips sources={best(items.map((x) => x.sources))} max={2} />} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((p) => {
          const range = fmtRange(p.start, p.end, false);
          return (
            <li key={p.id} className="rounded-md border border-rule bg-paper p-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[14px] font-semibold text-ink truncate">
                  {p.url ? <ExternalLink href={p.url} className="text-ink hover:text-accent-ink">{p.name}</ExternalLink> : p.name}
                </h3>
                {range && <span className="data text-ink-3 whitespace-nowrap">{range}</span>}
              </div>
              {p.description && <p className="mt-1 text-[13px] leading-5 text-ink-2">{p.description}</p>}
              <div className="mt-2"><SourceChips sources={p.sources} max={2} /></div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function PublicationsSection({ profile, i }: { profile: Profile; i: number }) {
  const items = profile.publications;
  if (!items.length) return null;
  return (
    <Card id="publications" i={i}>
      <SectionHeader id="publications-h" title="Publications" count={items.length} />
      <ul className="divide-y divide-rule">
        {items.map((p) => (
          <li key={p.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-[14px] font-semibold text-ink">{p.url ? <ExternalLink href={p.url} className="text-ink hover:text-accent-ink">{p.title}</ExternalLink> : p.title}</h3>
              {fmtPartialDate(p.published) && <span className="data text-ink-2">{fmtPartialDate(p.published)}</span>}
            </div>
            {p.publisher && <div className="text-[13px] text-ink-2">{p.publisher}</div>}
            {p.description && <p className="mt-1 text-[13px] leading-5 text-ink-2 max-w-prose">{p.description}</p>}
            <div className="mt-1.5"><SourceChips sources={p.sources} /></div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function VolunteerSection({ profile, i }: { profile: Profile; i: number }) {
  const items = profile.volunteer;
  if (!items.length) return null;
  return (
    <Card id="volunteer" i={i}>
      <SectionHeader id="volunteer-h" title="Volunteer work" count={items.length} />
      <ul className="divide-y divide-rule">
        {items.map((v) => {
          const range = fmtRange(v.start, v.end, undefined);
          return (
            <li key={v.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-[14px] font-semibold text-ink">{v.role}</h3>
                {range && <span className="data text-ink-2">{range}</span>}
              </div>
              <div className="text-[13px] text-ink-2">
                {v.organization}
                {v.cause && <span className="text-ink-3"> · {v.cause}</span>}
              </div>
              {v.description && <p className="mt-1 text-[13px] leading-5 text-ink-2 max-w-prose">{v.description}</p>}
              <div className="mt-1.5"><SourceChips sources={v.sources} /></div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function LinksSection({ profile, i }: { profile: Profile; i: number }) {
  const items = profile.links;
  if (!items.length) return null;
  return (
    <Card id="links" i={i}>
      <SectionHeader id="links-h" title="Public links" count={items.length} />
      <ul className="divide-y divide-rule">
        {items.map((l) => (
          <li key={l.id} className="py-2.5 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="min-w-0 flex items-baseline gap-3">
              <span className="w-24 shrink-0 text-[13px] font-medium text-ink">{NETWORK_LABEL[l.network] ?? l.network}</span>
              <ExternalLink href={l.url} className="data text-accent-ink truncate">
                {l.handle ? `@${l.handle}` : `${hostOf(l.url)}${new URL(l.url).pathname.replace(/\/$/, "")}`}
              </ExternalLink>
            </div>
            <SourceChips sources={l.sources} max={2} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Explicit list of what no source could supply. */
export function MissingSection({ profile, i }: { profile: Profile; i: number }) {
  const shown: FieldKey[] = profile.missing.filter((k) => k !== "photoUrl" && k !== "headline" && k !== "location" && k !== "currentRole" && k !== "fullName");
  if (!shown.length) return null;
  return (
    <section className="rise rounded-[10px] border border-dashed border-rule-2 p-5" style={idx(i)}>
      <SectionHeader id="missing" title="Not found in any source" count={shown.length} />
      <ul className="flex flex-wrap gap-2">
        {shown.map((k) => (
          <li key={k} className="inline-flex items-center gap-2 rounded-md bg-paper px-2.5 py-1 text-[13px] text-ink-2">
            <span className="inline-block size-2 rounded-full border border-rule-2" aria-hidden />
            {FIELD_LABELS[k]}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-ink-3">
        The sources consulted for this handle carry no record of these fields. An Apify token usually fills them from the LinkedIn profile.
      </p>
    </section>
  );
}
