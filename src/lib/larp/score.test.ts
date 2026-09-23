import { describe, expect, it } from "vitest";
import type { Profile } from "@/lib/schema/profile";
import { scoreLarp, verdictFor } from "./score";

const NOW = new Date("2026-09-23T00:00:00Z");

function profile(over: Partial<Profile> = {}): Profile {
  return {
    schemaVersion: 1,
    slug: "x",
    linkedinUrl: "https://www.linkedin.com/in/x",
    fullName: { value: "Ada", sources: [src()], confidence: 0.8 },
    photoUrl: null,
    headline: { value: "Engineer at Acme", sources: [src()], confidence: 0.8 },
    location: null,
    currentRole: { value: { title: "Engineer", company: "Acme" }, sources: [src()], confidence: 0.8 },
    about: null,
    experience: [
      {
        id: "exp-1",
        title: "Engineer",
        company: "Acme",
        start: { year: 2018 },
        current: true,
        description: "Shipped the billing service. Cut p99 from 800ms to 120ms for 2m requests/day.",
        sources: [src()],
        confidence: 0.8,
      },
    ],
    education: [{ id: "edu-1", school: "State", sources: [src()], confidence: 0.8 }],
    skills: [],
    certifications: [],
    projects: [],
    publications: [],
    volunteer: [],
    links: [],
    missing: [],
    confidence: 0.8,
    coverage: { populated: 5, total: 14 },
    synthetic: false,
    providers: [{ provider: "wikidata", label: "Wikidata", status: "ok", durationMs: 10 }],
    generatedAt: NOW.toISOString(),
    larp: { percent: 0, verdict: "grounded", line: "", signals: [] },
    ...over,
  };
}

const src = () => ({ provider: "a", label: "A", observedAt: NOW.toISOString(), confidence: 0.8 });

describe("scoreLarp", () => {
  it("stays inside 0–100 and bands the verdict", () => {
    expect(verdictFor(0)).toBe("grounded");
    expect(verdictFor(25)).toBe("polished");
    expect(verdictFor(50)).toBe("inflated");
    expect(verdictFor(75)).toBe("full-larp");
    const s = scoreLarp(profile(), NOW);
    expect(s.percent).toBeGreaterThanOrEqual(0);
    expect(s.percent).toBeLessThanOrEqual(100);
    expect(Number.isInteger(s.percent)).toBe(true);
  });

  it("keeps a single plain role low", () => {
    const s = scoreLarp(profile(), NOW);
    expect(s.verdict).toBe("grounded");
    expect(s.percent).toBeLessThan(25);
  });

  it("raises the score as keywords and roles pile up", () => {
    const one = scoreLarp(profile(), NOW);
    const wordy = scoreLarp(
      profile({
        headline: { value: "Passionate visionary leader", sources: [src()], confidence: 0.8 },
        about: { value: "Synergy, hustle, and a personal brand.", sources: [src()], confidence: 0.8 },
      }),
      NOW,
    );
    const career = scoreLarp(
      profile({
        experience: ["A", "B", "C", "D", "E"].map((company, i) => ({
          id: `exp-${i}`,
          title: "Engineer",
          company,
          start: { year: 2010 + i },
          end: { year: 2012 + i },
          sources: [src()],
          confidence: 0.8,
        })),
      }),
      NOW,
    );
    const likeSiddharth = scoreLarp(
      profile({
        headline: { value: "Computer Science student at The University of Texas at Dallas", sources: [src()], confidence: 0.8 },
        skills: Array.from({ length: 19 }, (_, i) => ({ id: `sk-${i}`, name: `Skill ${i}`, sources: [src()], confidence: 0.5 })),
        experience: Array.from({ length: 6 }, (_, i) => ({
          id: `exp-${i}`,
          title: "Developer",
          company: `Co ${i}`,
          start: { year: 2020 },
          end: { year: 2021 },
          sources: [src()],
          confidence: 0.8,
        })),
      }),
      NOW,
    );
    expect(likeSiddharth.percent).toBe(45);

    expect(wordy.percent).toBeGreaterThan(one.percent);
    expect(career.percent).toBeGreaterThan(one.percent);
    expect(career.percent).toBeLessThan(50);
  });

  it("scores theater titles, buzzwords and stacked roles as full larp", () => {
    const s = scoreLarp(
      profile({
        headline: {
          value: "Visionary Founder | 10x Thought Leader | Serial Entrepreneur | Disrupting the ecosystem",
          sources: [src()],
          confidence: 0.8,
        },
        about: {
          value: "Passionate guru and ninja. On a mission, changing the world. Award-winning personal brand!!! 🚀🚀",
          sources: [src()],
          confidence: 0.8,
        },
        currentRole: { value: { title: "Visionary Founder", company: "Me" }, sources: [src()], confidence: 0.8 },
        experience: ["Alpha", "Beta", "Gamma"].map((company, i) => ({
          id: `exp-${i}`,
          title: "Founder & CEO",
          company,
          start: { year: 2025 },
          current: true,
          sources: [src()],
          confidence: 0.8,
        })),
        education: [],
        skills: Array.from({ length: 32 }, (_, i) => ({ id: `s-${i}`, name: `Skill ${i}`, sources: [src()], confidence: 0.5 })),
        synthetic: true,
        providers: [{ provider: "demo", label: "Demo", status: "ok" as const, durationMs: 1 }],
      }),
      NOW,
    );
    expect(s.percent).toBeGreaterThanOrEqual(75);
    expect(s.verdict).toBe("full-larp");
    expect(s.signals.some((x) => x.id === "keywords" && x.points > 0)).toBe(true);
    expect(s.signals.some((x) => x.id === "theater-title")).toBe(true);
  });
});
