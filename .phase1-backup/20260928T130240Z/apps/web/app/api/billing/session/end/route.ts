import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { endSession } from "@/lib/billing/session-service";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({ sessionId: z.string().uuid() });

export async function POST(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "sessionId required." }, { status: 422 });
  }

  const result = await endSession({
    sessionId: parsed.data.sessionId,
    userId: user.id,
    actor: "user",
  });

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
