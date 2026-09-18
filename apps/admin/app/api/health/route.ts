import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface C { name: string; status: "ok"|"degraded"|"down"; latencyMs?: number; error?: string }
async function timed(n: string, fn: () => Promise<void>): Promise<C> {
  const s = Date.now();
  try { await fn(); return { name: n, status: "ok", latencyMs: Date.now()-s }; }
  catch (e) { return { name: n, status: "down", latencyMs: Date.now()-s, error: e instanceof Error ? e.message : String(e) }; }
}
export async function GET() {
  const t0 = Date.now();
  const checks: C[] = [];
  checks.push(await timed("database", async () => {
    const a = createAdminClient();
    const { error } = await a.from("User").select("id", { count: "exact", head: true }).limit(1);
    if (error) throw new Error(error.message);
  }));
  checks.push(await timed("env-supabase", async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("URL missing");
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("Anon key missing");
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Service role key missing");
  }));
  checks.push(await timed("web-proxy", async () => {
    const w = (process.env.NEXT_PUBLIC_APP_URL||"").replace(/\/$/,"");
    if (!w) throw new Error("NEXT_PUBLIC_APP_URL not set");
    const r = await fetch(w + "/api/health", { signal: AbortSignal.timeout(5000) });
    if (r.status >= 500) throw new Error("Web health HTTP " + r.status);
  }));
  const critical = ["database", "env-supabase"];
  const criticalDown = checks.some(c => critical.includes(c.name) && c.status === "down");
  const anyDown = checks.some(c => c.status === "down");
  const status = criticalDown ? "down" : anyDown ? "degraded" : "ok";
  return NextResponse.json({
    status, timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    region: process.env.VERCEL_REGION || "local",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7) || "local",
    uptime: Math.floor(process.uptime()),
    responseTimeMs: Date.now() - t0,
    checks,
  }, { status: criticalDown ? 503 : 200, headers: { "Cache-Control": "no-store, max-age=0" } });
}
