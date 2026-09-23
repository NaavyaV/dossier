import type { PartialDate } from "@/lib/schema/profile";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtPartialDate(d?: PartialDate): string | undefined {
  if (!d) return undefined;
  if (d.month) return `${MONTHS[d.month - 1]} ${d.year}`;
  return String(d.year);
}

export function fmtRange(start?: PartialDate, end?: PartialDate, current?: boolean): string | undefined {
  const s = fmtPartialDate(start);
  const e = current || (start && !end) ? "Present" : fmtPartialDate(end);
  if (!s && !e) return undefined;
  if (s && e) return `${s} – ${e}`;
  return s ?? e;
}

/** "2 yrs 3 mos" for a partial-date span. */
export function fmtDuration(start?: PartialDate, end?: PartialDate, now = new Date()): string | undefined {
  if (!start) return undefined;
  const s = new Date(start.year, (start.month ?? 1) - 1, 1);
  const e = end ? new Date(end.year, (end.month ?? 12) - 1, 1) : now;
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
  if (months < 1) return undefined;
  if (!start.month && !end?.month) months = Math.max(12, Math.round(months / 12) * 12);
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y) parts.push(`${y} yr${y > 1 ? "s" : ""}`);
  if (m && (!y || start.month)) parts.push(`${m} mo${m > 1 ? "s" : ""}`);
  return parts.join(" ");
}

export function relativeTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "unknown";
  const diff = Math.max(0, now - t);
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 60) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 24) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

/** "in 3h" style countdown to a future ISO time. */
export function untilTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t <= now) return "now";
  const m = Math.ceil((t - now) / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

export type Signal = "ok" | "mid" | "low";
export function confidenceSignal(c: number): Signal {
  if (c >= 0.8) return "ok";
  if (c >= 0.6) return "mid";
  return "low";
}
export function freshnessSignal(iso: string, now = Date.now()): Signal {
  const days = (now - Date.parse(iso)) / 86_400_000;
  if (!Number.isFinite(days) || days <= 90) return "ok";
  if (days <= 365) return "mid";
  return "low";
}

export function initials(name?: string): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const NETWORK_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  github: "GitHub",
  twitter: "X / Twitter",
  website: "Website",
  wikipedia: "Wikipedia",
  wikidata: "Wikidata",
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  medium: "Medium",
  substack: "Substack",
  scholar: "Google Scholar",
  orcid: "ORCID",
  mastodon: "Mastodon",
  bluesky: "Bluesky",
  threads: "Threads",
  crunchbase: "Crunchbase",
};
