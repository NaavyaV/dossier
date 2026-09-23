import { NextResponse } from "next/server";
import { z } from "zod";
import { toAppError } from "@/lib/errors";
import { rateLimitHeaders } from "@/lib/infra/ratelimit";
import { getProfile } from "@/lib/service/getProfile";

export const dynamic = "force-dynamic";

const Query = z.object({
  url: z.string().trim().min(1, "Provide `url` (a LinkedIn profile URL or handle).").max(2048),
  refresh: z.enum(["1", "true"]).optional(),
});

/**
 * GET /api/profile?url=<linkedin url | handle>[&refresh=1]
 *
 * Returns { ok: true, profile, cache } or { ok: false, error: { code, message, details? } }.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const parsed = Query.safeParse({ url: sp.get("url") ?? sp.get("slug") ?? "", refresh: sp.get("refresh") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Invalid query." } },
      { status: 400, headers: noStore },
    );
  }

  try {
    const result = await getProfile(parsed.data.url, { refresh: Boolean(parsed.data.refresh), headers: req.headers });
    const headers: Record<string, string> = {
      ...(result.rateLimit ? rateLimitHeaders(result.rateLimit) : {}),
      "Cache-Control": result.cache.hit ? "public, max-age=60, s-maxage=300" : "public, max-age=30, s-maxage=120",
      "X-Cache": result.cache.hit ? "HIT" : "MISS",
    };
    return NextResponse.json({ ok: true, profile: result.profile, cache: result.cache }, { headers });
  } catch (e) {
    const err = toAppError(e);
    if (err.code === "INTERNAL") console.error("[api/profile]", e);
    const headers: Record<string, string> = { ...noStore };
    if (err.retryAfterSeconds) headers["Retry-After"] = String(err.retryAfterSeconds);
    return NextResponse.json({ ok: false, error: err.toJSON() }, { status: err.status, headers });
  }
}

const noStore = { "Cache-Control": "no-store" } as const;
