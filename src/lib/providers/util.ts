import type { PartialDate, LinkInput } from "@/lib/schema/profile";

/** Coerce loose date strings into PartialDate: "2019", "2019-03", "Mar 2019", "2019-03-01T00:00:00Z", {year, month}. */
export function toPartialDate(input: unknown): PartialDate | undefined {
  if (!input) return undefined;
  if (typeof input === "object") {
    const o = input as Record<string, unknown>;
    const year = num(o.year);
    if (!year) return undefined;
    const month = num(o.month);
    const day = num(o.day);
    return { year, ...(month ? { month } : {}), ...(day ? { day } : {}) };
  }
  if (typeof input === "number") {
    return input >= 1900 && input <= 2100 ? { year: input } : undefined;
  }
  if (typeof input !== "string") return undefined;
  const s = input.trim();
  if (!s || /^present$/i.test(s)) return undefined;

  // ISO-ish: 2019, 2019-03, 2019-03-05, 2019-03-05T...
  let m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(s);
  if (m) {
    const year = Number(m[1]);
    if (year < 1900 || year > 2100) return undefined;
    const month = m[2] ? Number(m[2]) : undefined;
    const day = m[3] ? Number(m[3]) : undefined;
    return {
      year,
      ...(month && month >= 1 && month <= 12 ? { month } : {}),
      ...(day && day >= 1 && day <= 31 ? { day } : {}),
    };
  }
  // "Mar 2019", "March 2019"
  m = /^([A-Za-z]{3,9})\.?\s+(\d{4})$/.exec(s);
  if (m) {
    const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
    const year = Number(m[2]);
    if (year >= 1900 && year <= 2100) return { year, ...(month ? { month } : {}) };
  }
  // "03/2019"
  m = /^(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    const month = Number(m[1]);
    const year = Number(m[2]);
    if (year >= 1900 && year <= 2100) return { year, ...(month >= 1 && month <= 12 ? { month } : {}) };
  }
  return undefined;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  return undefined;
}

/** Split "Mar 2019 - Present" / "2015 – 2019" into start/end. */
export function splitDateRange(range: unknown): { start?: PartialDate; end?: PartialDate; current?: boolean } {
  if (typeof range !== "string") return {};
  const parts = range.split(/\s*[-–—]\s*|\s+to\s+/i).map((p) => p.trim());
  const start = toPartialDate(parts[0]);
  const endRaw = parts[1];
  const current = endRaw ? /present|current|now/i.test(endRaw) : undefined;
  const end = current ? undefined : toPartialDate(endRaw);
  return { ...(start ? { start } : {}), ...(end ? { end } : {}), ...(current ? { current } : {}) };
}

export function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s.length ? s : undefined;
}

export function httpUrl(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

export function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** Classify a URL into a network id. */
export function classifyLink(url: string): LinkInput["network"] {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "website";
  }
  if (host.endsWith("linkedin.com")) return "linkedin";
  if (host === "github.com") return "github";
  if (host === "twitter.com" || host === "x.com") return "twitter";
  if (host.endsWith("wikipedia.org")) return "wikipedia";
  if (host === "wikidata.org") return "wikidata";
  if (host.endsWith("youtube.com")) return "youtube";
  if (host === "instagram.com") return "instagram";
  if (host === "facebook.com") return "facebook";
  if (host.endsWith("medium.com")) return "medium";
  if (host === "substack.com" || host.endsWith(".substack.com")) return "substack";
  if (host === "scholar.google.com") return "scholar";
  if (host === "orcid.org") return "orcid";
  if (host.endsWith("mastodon.social") || host.includes("mastodon")) return "mastodon";
  if (host === "bsky.app") return "bluesky";
  if (host === "threads.net") return "threads";
  if (host === "crunchbase.com") return "crunchbase";
  return "website";
}

export function handleFromUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean);
    return seg.length ? seg[seg.length - 1].replace(/^@/, "") : undefined;
  } catch {
    return undefined;
  }
}

/** JSON fetch with timeout that never throws on non-2xx; returns status + body. */
export async function fetchJson(
  url: string,
  init: RequestInit & { signal: AbortSignal },
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, init);
  let body: unknown = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}
