import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const { data: consultant } = await admin
    .from("Consultant").select("id").eq("userId", userId).maybeSingle();
  if (!consultant) return NextResponse.json({ requests: [] });

  const { data } = await admin
    .from("PricingChangeRequest")
    .select("*")
    .eq("consultantId", (consultant as { id: string }).id)
    .order("createdAt", { ascending: false })
    .limit(50);

  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(req: Request) {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  let body: { requestedRates?: Record<string, number>; reason?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: consultant } = await admin
    .from("Consultant").select("id").eq("userId", userId).maybeSingle();
  if (!consultant) return NextResponse.json({ error: "Not a consultant" }, { status: 403 });

  const { data, error } = await admin.rpc("request_pricing_change", {
    p_consultant_id: (consultant as { id: string }).id,
    p_requested: body.requestedRates ?? {},
    p_reason: body.reason ?? "",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { success?: boolean; error?: string } | null;
  if (result && result.success === false) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
