// apps/admin/app/api/error-log/route.ts
// NOTE: intentionally public — client errors fire before login (handoff failure, etc.).
// Rate-limited at the edge by Vercel. Body is logged, never persisted.
// Server-side sink for client error reports. Non-authenticated: errors can
// happen before login (e.g. handoff failure). Rate-limited at the edge.
import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.error("[admin/client-error]", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
