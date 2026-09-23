/** String normalization and similarity helpers used for duplicate resolution. */

const ORG_NOISE = /\b(inc|inc\.|llc|ltd|ltd\.|limited|corp|corp\.|corporation|co|co\.|company|gmbh|plc|s\.a\.|ag|the)\b/g;

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeOrg(s: string): string {
  return normalizeText(s).replace(ORG_NOISE, " ").replace(/\s+/g, " ").trim();
}

/** Sørensen–Dice coefficient over character bigrams. 0..1 */
export function dice(a: string, b: string): number {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const grams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const ga = grams(x);
  const gb = grams(y);
  let inter = 0;
  for (const [g, n] of ga) inter += Math.min(n, gb.get(g) ?? 0);
  return (2 * inter) / (x.length - 1 + (y.length - 1));
}

/** Token-set containment: how much of the shorter token set appears in the longer. */
export function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normalizeText(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  let hit = 0;
  for (const t of small) if (big.has(t)) hit++;
  return hit / small.size;
}

export function sameOrg(a: string, b: string): boolean {
  const x = normalizeOrg(a);
  const y = normalizeOrg(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.startsWith(y) || y.startsWith(x)) return true;
  return dice(x, y) >= 0.82 || tokenOverlap(x, y) >= 0.99;
}

export function similarTitle(a?: string, b?: string): boolean {
  if (!a || !b) return true; // unknown title never blocks a match
  return dice(a, b) >= 0.6 || tokenOverlap(a, b) >= 0.6;
}
