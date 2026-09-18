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
  checks.push(await timed("env-payments", async () => {
    const i = !!process.env.INSTAMOJO_API_KEY && !!process.env.INSTAMOJO_AUTH_TOKEN;
    const r = !!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;
    if (!i && !r) throw new Error("No payment provider configured");
  }));
  checks.push(await timed("env-ai", async () => {
    if (!process.env.GROQ_API_KEY) throw new Error("Groq key missing");
  }));
  checks.push(await timed("env-email", async () => {
    if (!process.env.RESEND_API_KEY) throw new Error("Resend key missing");
  }));
  checks.push(await timed("realtime-flag", async () => {
    if (process.env.NEXT_PUBLIC_REALTIME_ENABLED !== "true") throw new Error("Realtime not enabled");
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
