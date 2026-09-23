import { describe, expect, it } from "vitest";
import type { ProviderMeta, ProviderProfile } from "@/lib/schema/profile";
import { Profile } from "@/lib/schema/profile";
import { combine, freshnessFactor, mergeProfiles } from "./merge";

const NOW = Date.parse("2026-09-23T00:00:00Z");
const meta = (provider: string, baseConfidence: number, daysOld = 0, extra: Partial<ProviderMeta> = {}): ProviderMeta => ({
  provider,
  label: provider.toUpperCase(),
  observedAt: new Date(NOW - daysOld * 86_400_000).toISOString(),
  baseConfidence,
  ...extra,
});
const ctx = { slug: "x", linkedinUrl: "https://www.linkedin.com/in/x", runs: [], now: NOW };

describe("confidence math", () => {
  it("noisy-OR raises confidence with agreement", () => {
    expect(combine([0.8])).toBe(0.8);
    expect(combine([0.8, 0.5])).toBeCloseTo(0.9, 3);
    expect(combine([])).toBe(0);
  });
  it("discounts stale observations", () => {
    expect(freshnessFactor(new Date(NOW).toISOString(), NOW)).toBe(1);
    expect(freshnessFactor(new Date(NOW - 400 * 86_400_000).toISOString(), NOW)).toBe(0.8);
  });
});

describe("mergeProfiles", () => {
  const a: ProviderProfile = {
    fullName: "Priya Raman",
    headline: "Staff Engineer at Meridian",
    location: "Toronto, Ontario, Canada",
    currentTitle: "Staff Engineer",
    currentCompany: "Meridian",
    experience: [
      { title: "Staff Engineer", company: "Meridian", start: { year: 2023, month: 4 }, current: true },
      { title: "Senior Software Engineer", company: "Stripe", start: { year: 2019, month: 8 }, end: { year: 2023, month: 3 }, description: "Long description here." },
    ],
    skills: [{ name: "PostgreSQL", endorsements: 10 }, { name: "Go" }],
    links: [{ network: "github", url: "https://github.com/priya-raman", handle: "priya-raman" }],
  };
  const b: ProviderProfile = {
    fullName: "Priya  Raman",
    headline: "Senior Software Engineer at Stripe",
    location: "Toronto, Canada",
    experience: [{ title: "Sr. Software Engineer", company: "Stripe, Inc.", start: { year: 2019 }, end: { year: 2023 } }],
    skills: [{ name: "Postgres" }, { name: "Golang" }],
    links: [{ network: "github", url: "https://github.com/priya-raman/" }],
  };

  it("produces a schema-valid profile", () => {
    const p = mergeProfiles([{ profile: a, meta: meta("a", 0.9) }, { profile: b, meta: meta("b", 0.7, 400) }], ctx);
    expect(() => Profile.parse(p)).not.toThrow();
  });

  it("corroborates agreeing scalars and records conflicts", () => {
    const p = mergeProfiles([{ profile: a, meta: meta("a", 0.9) }, { profile: b, meta: meta("b", 0.7, 400) }], ctx);
    expect(p.fullName?.value).toBe("Priya Raman");
    expect(p.fullName?.sources.map((s) => s.provider).sort()).toEqual(["a", "b"]);
    expect(p.fullName?.confidence).toBeGreaterThan(0.9);
    // Headlines disagree: fresher, higher-confidence source wins; loser is kept.
    expect(p.headline?.value).toBe("Staff Engineer at Meridian");
    expect(p.headline?.conflicts?.[0].value).toBe("Senior Software Engineer at Stripe");
    expect(p.headline?.conflicts?.[0].source.provider).toBe("b");
  });

  it("de-duplicates experience across sources with fuzzy org/title/date matching", () => {
    const p = mergeProfiles([{ profile: a, meta: meta("a", 0.9) }, { profile: b, meta: meta("b", 0.7) }], ctx);
    expect(p.experience).toHaveLength(2);
    const stripe = p.experience.find((e) => /stripe/i.test(e.company))!;
    expect(stripe.sources).toHaveLength(2);
    expect(stripe.title).toBe("Senior Software Engineer"); // higher-confidence source's field wins
    expect(stripe.description).toBe("Long description here.");
    expect(stripe.start).toEqual({ year: 2019, month: 8 });
    // Current role sorts first.
    expect(p.experience[0].company).toBe("Meridian");
    expect(p.experience[0].id).toBe("exp-1");
  });

  it("merges skills with alias tolerance and links by canonical URL", () => {
    const p = mergeProfiles([{ profile: a, meta: meta("a", 0.9) }, { profile: b, meta: meta("b", 0.7) }], ctx);
    const names = p.skills.map((s) => s.name);
    expect(names).toContain("PostgreSQL");
    expect(names).not.toContain("Postgres");
    // "Go" vs "Golang" are intentionally NOT merged (too short to be safe).
    expect(names).toContain("Go");
    const gh = p.links.filter((l) => l.network === "github");
    expect(gh).toHaveLength(1);
    expect(gh[0].sources).toHaveLength(2);
    expect(p.links[0].network).toBe("linkedin"); // canonical URL is always present
  });

  it("reports missing fields and coverage honestly", () => {
    const p = mergeProfiles([{ profile: a, meta: meta("a", 0.9) }], ctx);
    expect(p.missing).toContain("education");
    expect(p.missing).toContain("photoUrl");
    expect(p.missing).not.toContain("experience");
    expect(p.coverage.populated + p.missing.length).toBe(p.coverage.total);
    expect(p.synthetic).toBe(false);
  });

  it("flags synthetic sources", () => {
    const p = mergeProfiles([{ profile: a, meta: meta("demo", 0.9, 0, { synthetic: true }) }], ctx);
    expect(p.synthetic).toBe(true);
  });
});
