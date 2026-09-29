// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/wallet/topup — create Instamojo payment request
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  amount: z.number().int().min(10).max(100_000),
});

export async function POST(req: Request) {
  // ─── Auth ────────────────────────────────────────────────────────────────
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  // ─── Body ────────────────────────────────────────────────────────────────
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid amount." },
      { status: 422 },
    );
  }

  const { amount } = parsed.data;

  const isProd = process.env.NODE_ENV === "production";
  const endpoint = isProd
    ? "https://www.instamojo.com/api/1.1/payment-requests/"
    : "https://test.instamojo.com/api/1.1/payment-requests/";

  const apiKey = process.env.INSTAMOJO_API_KEY;
  const authToken = process.env.INSTAMOJO_AUTH_TOKEN;

  if (!apiKey || !authToken) {
    // Dev fallback — no gateway configured
    return NextResponse.json({
      paymentUrl: "/wallet?mock_payment_success=true",
    });
  }

  const payload = new URLSearchParams({
    purpose: "Wallet Topup",
    amount: amount.toString(),
    buyer_name: user.id,
    redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/wallet`,
    webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/wallet/webhooks/instamojo`,
    allow_repeated_payments: "False",
  });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "X-Auth-Token": authToken,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload.toString(),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error("[wallet/topup] gateway error:", data);
      return NextResponse.json(
        { error: "Payment gateway is temporarily unavailable." },
        { status: 502 },
      );
    }

    return NextResponse.json({ paymentUrl: data.payment_request.longurl });
  } catch (err) {
    console.error("[wallet/topup] fatal:", err);
    return NextResponse.json(
      { error: "Payment gateway is temporarily unavailable." },
      { status: 500 },
    );
  }
}
