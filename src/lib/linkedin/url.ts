/**
 * Parse and validate public LinkedIn profile URLs.
 *
 * Accepts the shapes people actually paste:
 *   https://www.linkedin.com/in/satyanadella/
 *   linkedin.com/in/satyanadella
 *   https://uk.linkedin.com/in/satyanadella?originalSubdomain=uk
 *   www.linkedin.com/pub/... (legacy; rejected — no public canonical form)
 *   satyanadella (a bare slug)
 */

export type ParsedLinkedInUrl = {
  slug: string;
  canonicalUrl: string;
};

export type LinkedInUrlError =
  | { code: "EMPTY"; message: string }
  | { code: "NOT_LINKEDIN"; message: string }
  | { code: "NOT_PROFILE"; message: string }
  | { code: "BAD_SLUG"; message: string };

export type ParseResult =
  | { ok: true; value: ParsedLinkedInUrl }
  | { ok: false; error: LinkedInUrlError };

// LinkedIn vanity slugs: 3–100 chars, letters/digits/hyphens, plus some
// unicode letters for non-Latin names. Percent-encoding is decoded first.
const SLUG_RE = /^[\p{L}\p{N}][\p{L}\p{N}\-_.]{1,99}$/u;

const LINKEDIN_HOST_RE = /^([a-z]{2,3}\.)?(www\.)?linkedin\.com$/i;

export function canonicalLinkedInUrl(slug: string): string {
  return `https://www.linkedin.com/in/${encodeURIComponent(slug)}`;
}

export function normalizeSlug(raw: string): string | null {
  let s = raw.trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    // leave as-is
  }
  s = s.replace(/\/+$/, "").toLowerCase();
  if (!SLUG_RE.test(s)) return null;
  // Reserved paths that are not people.
  if (["in", "company", "school", "pub", "jobs", "feed"].includes(s)) return null;
  return s;
}

export function parseLinkedInUrl(input: string): ParseResult {
  const raw = (input ?? "").trim();
  if (!raw) {
    return { ok: false, error: { code: "EMPTY", message: "Paste a LinkedIn profile URL to begin." } };
  }

  // Bare slug: no dots, no slashes.
  if (!raw.includes("/") && !raw.includes(".")) {
    const slug = normalizeSlug(raw);
    if (!slug) {
      return {
        ok: false,
        error: { code: "BAD_SLUG", message: "That doesn't look like a LinkedIn profile handle." },
      };
    }
    return { ok: true, value: { slug, canonicalUrl: canonicalLinkedInUrl(slug) } };
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: { code: "NOT_LINKEDIN", message: "That isn't a valid URL." } };
  }

  if (!LINKEDIN_HOST_RE.test(url.hostname)) {
    return {
      ok: false,
      error: { code: "NOT_LINKEDIN", message: "Only linkedin.com profile URLs are supported." },
    };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  // Some locales prefix a path like /mwlite/in/slug
  const inIdx = segments.findIndex((s) => s.toLowerCase() === "in");
  if (inIdx === -1 || !segments[inIdx + 1]) {
    const first = segments[0]?.toLowerCase();
    const hint =
      first === "company"
        ? "Company pages aren't supported — paste a person's /in/ profile."
        : first === "pub"
          ? "Legacy /pub/ URLs have no public canonical form. Use the /in/ URL instead."
          : "Paste a profile URL in the form linkedin.com/in/handle.";
    return { ok: false, error: { code: "NOT_PROFILE", message: hint } };
  }

  const slug = normalizeSlug(segments[inIdx + 1]);
  if (!slug) {
    return {
      ok: false,
      error: { code: "BAD_SLUG", message: "That profile handle contains unsupported characters." },
    };
  }

  return { ok: true, value: { slug, canonicalUrl: canonicalLinkedInUrl(slug) } };
}
