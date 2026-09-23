import { describe, expect, it } from "vitest";
import { parseLinkedInUrl } from "./url";

describe("parseLinkedInUrl", () => {
  it.each([
    ["https://www.linkedin.com/in/satyanadella/", "satyanadella"],
    ["linkedin.com/in/satyanadella", "satyanadella"],
    ["https://uk.linkedin.com/in/Satya-Nadella-123?originalSubdomain=uk", "satya-nadella-123"],
    ["http://linkedin.com/in/jane.doe_99", "jane.doe_99"],
    ["www.linkedin.com/mwlite/in/someone", "someone"],
    ["satyanadella", "satyanadella"],
    ["  https://www.linkedin.com/in/priya%2Draman  ", "priya-raman"],
  ])("accepts %s → %s", (input, slug) => {
    const r = parseLinkedInUrl(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.slug).toBe(slug);
      expect(r.value.canonicalUrl).toBe(`https://www.linkedin.com/in/${encodeURIComponent(slug)}`);
    }
  });

  it.each([
    ["", "EMPTY"],
    ["https://twitter.com/someone", "NOT_LINKEDIN"],
    ["https://www.linkedin.com/company/microsoft", "NOT_PROFILE"],
    ["https://www.linkedin.com/pub/john/1/2/3", "NOT_PROFILE"],
    ["https://www.linkedin.com/in/", "NOT_PROFILE"],
    ["https://www.linkedin.com/in/a", "BAD_SLUG"],
    ["not a url at all!!", "BAD_SLUG"],
    ["https://evil.com/linkedin.com/in/x", "NOT_LINKEDIN"],
    ["https://linkedin.com.evil.com/in/x", "NOT_LINKEDIN"],
  ])("rejects %s with %s", (input, code) => {
    const r = parseLinkedInUrl(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(code);
  });
});
