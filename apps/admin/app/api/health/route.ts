// apps/admin/app/api/health/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Admin-side health. Mirrors web but adds:
//   • admin-session reachability (Supabase auth.getUser)
//   • proxy reachability (HEAD to web /api/health)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createServerClientFromCookies, createAdminClient } from "@zeal/database/server";

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

  checks.push(await timed("env.supabase", async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("URL missing");
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("Anon key missing");
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Service role key missing");
  }));

  checks.push(await timed("database", async () => {
    const admin = createAdminClient();
    const { error } = await admin.from("User").select("id", { count: "exact", head: true }).limit(1);
    if (error) throw new Error(error.message);
  }));

  checks.push(await timed("admin.session", async () => {
    const supabase = await createServerClientFromCookies();
    const { error } = await supabase.auth.getUser();
    // Not an error if anonymous — just verifying the SSR client can talk to GoTrue
    if (error && !error.message.toLowerCase().includes("auth session missing")) {
      throw new Error(error.message);
    }
  }));

  checks.push(await timed("proxy.web", async () => {
    const webUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    if (!webUrl) throw new Error("NEXT_PUBLIC_APP_URL not set");
    const res = await fetch(`${webUrl}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
      headers: { "X-Health-Probe": "admin" },
    });
    if (!res.ok && res.status !== 503) throw new Error(`Web health HTTP ${res.status}`);
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
