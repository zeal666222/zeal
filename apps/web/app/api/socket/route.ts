// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/socket — WebSocket endpoint stub
// ═══════════════════════════════════════════════════════════════════════════════
// Realtime in Zeal uses Supabase Broadcast, not raw WebSockets. This endpoint
// exists for external clients that probe a socket URL. Returns a lightweight
// status payload.
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET() {
  return NextResponse.json({
    message: "Zeal uses Supabase Broadcast for realtime.",
    status: "online",
    timestamp: new Date().toISOString(),
  });
}
