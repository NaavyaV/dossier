import type { PartialDate, Profile } from "@/lib/schema/profile";

/**
 * LARP score — an arbitrary, fully disclosed exaggeration heuristic.
 *
 * It does not detect fraud and it does not know whether a person is telling
 * the truth. It scores how much the *public text* of a profile performs:
 * theater titles, buzzwords, stacked current roles, skill bloat — minus the
 * things that read as specific (numbers, long tenure, education, a second
 * source agreeing). Output is an integer 0–100.
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
const CONCRETE = /(?:\$\s?\d|\b\d[\d,.]*\s?(?:%|x|k|m|bn|users|customers|tps|ms|req\/s))\b/i;
const EMOJI = /\p{Extended_Pictographic}/gu;

type Input = Pick<
  Profile,
  "headline" | "about" | "currentRole" | "experience" | "education" | "skills" | "providers" | "synthetic"
>;

function found(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  return BUZZ.filter((p) => lower.includes(p));
}

function years(start?: PartialDate, end?: PartialDate, current?: boolean, nowYear = new Date().getFullYear()): number {
  if (!start) return 0;
  const endYear = end?.year ?? (current || !end ? nowYear : start.year);
  return Math.max(0, endYear - start.year);
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

export function scoreLarp(profile: Input, now = new Date()): LarpScore {
  const nowYear = now.getFullYear();
  const headline = profile.headline?.value ?? "";
  const about = profile.about?.value ?? "";
  const title = profile.currentRole?.value.title ?? "";
  const signals: LarpSignal[] = [];
  const push = (id: string, label: string, detail: string, points: number) => {
    if (points !== 0) signals.push({ id, label, detail, points });
  };

  // Everyone performs a little. The rest is earned.
  let total = 8;
  signals.push({ id: "base", label: "Baseline", detail: "A profile is already a performance. Everyone starts here.", points: 8 });

  const headlineHits = found(headline);
  push(
    "headline-buzz",
    "Headline buzzwords",
    headlineHits.length ? headlineHits.slice(0, 6).join(", ") : "",
    Math.min(20, headlineHits.length * 5),
  );

  const aboutHits = found(about).filter((p) => !headlineHits.includes(p));
  push("about-buzz", "About buzzwords", aboutHits.length ? aboutHits.slice(0, 6).join(", ") : "", Math.min(16, aboutHits.length * 3));

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

  const skillCount = profile.skills.length;
  push("skills", "Skill bloat", `${skillCount} skills listed`, skillCount > 20 ? Math.min(12, Math.floor((skillCount - 20) / 4) * 3) : 0);

  const bangs = (headline.match(/!/g) ?? []).length + (about.match(/!/g) ?? []).length;
  push("bangs", "Exclamation marks", `${bangs} in the headline and about`, Math.min(9, bangs * 3));

  const emoji = (headline.match(EMOJI) ?? []).length + (about.match(EMOJI) ?? []).length;
  push("emoji", "Emoji", `${emoji} in the headline and about`, Math.min(8, emoji * 2));

  const blurbs = profile.experience.map((e) => e.description ?? "").join(" \n ");
  const concrete = blurbs.split(/\n|(?<=\.)\s/).filter((s) => CONCRETE.test(s)).length;
  push("concrete", "Specific numbers", `${concrete} experience line${concrete === 1 ? "" : "s"} with a real figure`, -Math.min(16, concrete * 4));

  const longest = profile.experience.reduce((m, e) => Math.max(m, years(e.start, e.end, e.current, nowYear)), 0);
  push("tenure", "Longest stay", longest ? `${longest} year${longest === 1 ? "" : "s"} in one role` : "no dated roles", longest >= 5 ? -10 : longest >= 3 ? -5 : 0);

  push("education", "Education on record", profile.education.length ? `${profile.education.length} school${profile.education.length === 1 ? "" : "s"}` : "none", profile.education.length ? -5 : 0);

  // Fixtures can't corroborate themselves, so sample profiles don't get this discount.
  const agreeing = profile.synthetic ? 0 : profile.providers.filter((p) => p.status === "ok").length;
  push(
    "corroboration",
    "More than one source agrees",
    agreeing >= 2 ? `${agreeing} sources contributed` : "a single source",
    agreeing >= 2 ? -8 : 0,
  );
  const described = profile.experience.filter((e) => (e.description?.length ?? 0) > 80);
  push("described", "Roles actually described", `${described.length} with a real write-up`, described.length >= 2 ? -6 : 0);

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
