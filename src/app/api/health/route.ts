import { NextResponse } from "next/server";
import { getRuntimeEnv } from "@/lib/infra/env";
import { buildProviders } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

/** GET /api/health — which providers and infrastructure are live. Never returns secrets. */
export async function GET() {
  const env = getRuntimeEnv();
  const providers = buildProviders(env).map((p) => ({
    id: p.id,
    label: p.label,
    phase: p.phase,
    enabled: p.isEnabled(env),
    ...(p.isEnabled(env) ? {} : { reason: p.disabledReason?.(env) ?? "Disabled" }),
    license: p.license,
  }));
  return NextResponse.json(
    {
      ok: true,
      time: new Date().toISOString(),
      infra: {
        cache: env.PROFILE_CACHE ? "kv" : "memory",
        rateLimit: env.RATE_LIMIT ? "kv" : "memory",
      },
      providers,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
