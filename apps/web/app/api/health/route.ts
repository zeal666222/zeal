// apps/web/app/api/health/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Rich diagnostics: DB · env · payments · AI · email · realtime · Redis.
// Status codes: 200 ok · 200 degraded · 503 down
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckResult {
  name: string;
  status: "ok" | "degraded" | "down";
  latencyMs?: number;
  error?: string;
}

async function timed(name: string, fn: () => Promise<void>): Promise<CheckResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      name,
      status: "down",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  const start = Date.now();
  const checks: CheckResult[] = [];

  checks.push(await timed("database", async () => {
    const admin = createAdminClient();
    const { error } = await admin.from("User").select("id", { count: "exact", head: true }).limit(1);
    if (error) throw new Error(error.message);
  }));

  checks.push(await timed("env.supabase", async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("URL missing");
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("Anon key missing");
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Service role key missing");
  }));

  checks.push(await timed("env.payments", async () => {
    const hasInstamojo = !!process.env.INSTAMOJO_API_KEY && !!process.env.INSTAMOJO_AUTH_TOKEN;
    const hasRazorpay = !!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;
    if (!hasInstamojo && !hasRazorpay) throw new Error("No payment provider configured");
  }));

  checks.push(await timed("env.ai", async () => {
    if (!process.env.GROQ_API_KEY) throw new Error("Groq key missing");
  }));

  checks.push(await timed("env.email", async () => {
    if (!process.env.RESEND_API_KEY) throw new Error("Resend key missing");
  }));

  checks.push(await timed("env.realtime", async () => {
    if (process.env.NEXT_PUBLIC_REALTIME_ENABLED !== "true") {
      throw new Error("Realtime not enabled");
    }
  }));

  checks.push(await timed("redis", async () => {
    if (!process.env.UPSTASH_REDIS_REST_URL) throw new Error("Redis not configured");
    const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  }));

  const overall = checks.every((c) => c.status === "ok")
    ? "ok"
    : checks.some((c) => c.status === "down")
      ? "down"
      : "degraded";

  return NextResponse.json(
    {
      status: overall,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      region: process.env.VERCEL_REGION || "local",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
      uptime: Math.floor(process.uptime()),
      responseTimeMs: Date.now() - start,
      checks,
    },
    {
      status: overall === "down" ? 503 : 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
