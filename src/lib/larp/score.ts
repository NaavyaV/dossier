import type { Profile } from "@/lib/schema/profile";

/**
 * LARP score — an arbitrary exaggeration heuristic, biased high.
 *
 * More keyword hits and more jobs raise the score. A long résumé crosses into
 * a high score even without cartoon titles. Output is an integer 0–100.
 */

export type LarpSignal = {
  id: string;
  label: string;
  detail: string;
  /** Signed contribution, before the final clamp. */
  points: number;
};

export type LarpVerdict = "grounded" | "polished" | "inflated" | "full-larp";

export type LarpScore = {
  percent: number;
  verdict: LarpVerdict;
  /** One sentence, written for the page. */
  line: string;
  signals: LarpSignal[];
};

const BUZZ = [
  "thought leader",
  "visionary",
  "serial entrepreneur",
  "10x",
  "ninja",
  "guru",
  "rockstar",
  "rock star",
  "synergy",
  "disrupt",
  "ecosystem",
  "world-class",
  "world class",
  "award-winning",
  "award winning",
  "results-driven",
  "passionate",
  "hustle",
  "grind",
  "unicorn",
  "evangelist",
  "growth hacker",
  "personal brand",
  "best-in-class",
  "best in class",
  "on a mission",
  "changing the world",
  "change the world",
  "excited to announce",
  "humbled",
  "grateful",
  "influencer",
  "game-changer",
  "game changer",
];

const THEATER_TITLE = /\b(visionary|evangelist|ninja|guru|thought leader|10x|rockstar|rock star|influencer|futurist)\b/i;
const CHIEF = /\b(ceo|cto|cfo|coo|cmo|founder|co-founder|cofounder|chief)\b/i;
const EMOJI = /\p{Extended_Pictographic}/gu;

type Input = Pick<
  Profile,
  "headline" | "about" | "currentRole" | "experience" | "education" | "skills" | "providers" | "synthetic"
>;

/** Every buzzword mention in the text, including repeats. */
function keywordHits(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const phrase of BUZZ) {
    let from = 0;
    while (from < lower.length) {
      const at = lower.indexOf(phrase, from);
      if (at === -1) break;
      const before = at === 0 ? " " : lower[at - 1];
      const after = lower[at + phrase.length] ?? " ";
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) hits.push(phrase);
      from = at + phrase.length;
    }
  }
  return hits;
}

export function verdictFor(percent: number): LarpVerdict {
  if (percent >= 75) return "full-larp";
  if (percent >= 50) return "inflated";
  if (percent >= 25) return "polished";
  return "grounded";
}

const LINES: Record<LarpVerdict, string> = {
  grounded: "Reads like a job, not a performance.",
  polished: "Some staging. The specifics still hold it down.",
  inflated: "More costume than résumé.",
  "full-larp": "Full LARP. The profile is the character.",
};

export function scoreLarp(profile: Input, _now = new Date()): LarpScore {
  const headline = profile.headline?.value ?? "";
  const about = profile.about?.value ?? "";
  const title = profile.currentRole?.value.title ?? "";
  const signals: LarpSignal[] = [];
  const push = (id: string, label: string, detail: string, points: number) => {
    if (points !== 0) signals.push({ id, label, detail, points });
  };

  // Tuned so a 6-role, ~20-skill student profile lands near 45.
  // Keywords are what push that into the high bands.
  let total = 9;
  signals.push({ id: "base", label: "Baseline", detail: "Everyone starts here.", points: 9 });

  const corpus = [headline, about, title, ...profile.experience.flatMap((e) => [e.title ?? "", e.description ?? ""])].join("\n");
  const hits = keywordHits(corpus);
  push(
    "keywords",
    "Keywords",
    hits.length ? `${hits.length} mention${hits.length === 1 ? "" : "s"} · ${[...new Set(hits)].slice(0, 6).join(", ")}` : "",
    Math.min(55, hits.length * 8),
  );

  const pipes = (headline.match(/[|•·/]/g) ?? []).length;
  push("pipes", "Stacked headline", `${pipes} separators in the headline`, pipes >= 3 ? 10 : pipes === 2 ? 6 : 0);

  push("theater-title", "Theater title", title || "current title", THEATER_TITLE.test(`${title} ${headline}`) ? 14 : 0);

  const currentCount = profile.experience.filter((e) => e.current || (e.start && !e.end)).length;
  push(
    "multi-current",
    "Several jobs at once",
    `${currentCount} role${currentCount === 1 ? "" : "s"} marked current`,
    Math.min(21, Math.max(0, currentCount - 1) * 7),
  );

  const chiefsInHistory = profile.experience.filter((e) => CHIEF.test(e.title ?? "")).length;
  const chiefs = chiefsInHistory + (CHIEF.test(title) && !profile.experience.some((e) => (e.title ?? "").toLowerCase() === title.toLowerCase()) ? 1 : 0);
  push("chief-stack", "Chief / founder stack", `${chiefs} chief or founder title${chiefs === 1 ? "" : "s"}`, chiefs >= 3 ? 12 : chiefs === 2 ? 6 : 0);

  const roles = profile.experience.length;
  push("experience", "Experience", `${roles} role${roles === 1 ? "" : "s"}`, roles * 4);

  const skillCount = profile.skills.length;
  push("skills", "Skills", `${skillCount} listed`, Math.min(12, skillCount));

  const bangs = (headline.match(/!/g) ?? []).length + (about.match(/!/g) ?? []).length;
  push("bangs", "Exclamation marks", `${bangs} in the headline and about`, Math.min(9, bangs * 3));

  const emoji = (headline.match(EMOJI) ?? []).length + (about.match(EMOJI) ?? []).length;
  push("emoji", "Emoji", `${emoji} in the headline and about`, Math.min(8, emoji * 2));

  for (const s of signals) total += s.id === "base" ? 0 : s.points;
  const percent = Math.max(0, Math.min(100, Math.round(total)));
  const verdict = verdictFor(percent);

  return {
    percent,
    verdict,
    line: LINES[verdict],
    signals: signals.filter((s) => s.points !== 0).sort((a, b) => Math.abs(b.points) - Math.abs(a.points)),
  };
}
