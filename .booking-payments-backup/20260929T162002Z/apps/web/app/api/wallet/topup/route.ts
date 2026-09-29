// apps/web/app/api/wallet/topup/route.ts
// POST /api/wallet/topup            → create Razorpay order (idempotent)
// POST /api/wallet/topup?action=verify → verify signature + credit wallet
import { NextResponse } from "next/server";
import { createAdminClient, createServerClientFromCookies } from "@zeal/database/server";
import {
  createRazorpayOrder,
  getPublicKeyId,
  verifyPaymentSignature,
} from "@/lib/wallet/instamojo";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CreateBody = z.object({
  amount: z.number().int().min(10).max(100_000),
});
const VerifyBody = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "verify") {
    let raw: unknown;
    try { raw = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = VerifyBody.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid verification payload" }, { status: 422 });
    }
    const ok = verifyPaymentSignature({
      orderId: parsed.data.razorpay_order_id,
      paymentId: parsed.data.razorpay_payment_id,
      signature: parsed.data.razorpay_signature,
    });
    if (!ok) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: orderRow } = await admin
      .from("RazorpayPayment")
      .select('"orderId", amount, "userId", status')
      .eq("orderId", parsed.data.razorpay_order_id)
      .maybeSingle();
    const row = orderRow as { orderId: string; amount: number; userId: string; status: string } | null;
    if (!row || row.userId !== user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Idempotent credit — referenceId is the Razorpay payment id
    await admin.rpc("credit_funds_safe", {
      p_user_id: user.id,
      p_amount: row.amount / 100,
      p_description: `Wallet top-up ${parsed.data.razorpay_payment_id}`,
      p_reference_id: parsed.data.razorpay_payment_id,
    });

    await admin
      .from("RazorpayPayment")
      .update({
        paymentId: parsed.data.razorpay_payment_id,
        signature: parsed.data.razorpay_signature,
        status: "captured",
        updatedAt: new Date().toISOString(),
      } as never)
      .eq("orderId", parsed.data.razorpay_order_id);

    return NextResponse.json({ ok: true });
  }

  // ─── Default: create order ────────────────────────────────────────────────
  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid amount" },
      { status: 422 },
    );
  }
  const { amount } = parsed.data;
  const idemKey = req.headers.get("idempotency-key")?.trim() ?? "";

  const admin = createAdminClient();
  if (idemKey) {
    const { data: existing } = await admin
      .from("RazorpayPayment")
      .select('"orderId", amount, currency')
      .eq("userId", user.id)
      .eq("purpose", "wallet_topup")
      .contains("metadata", { idempotencyKey: idemKey } as never)
      .maybeSingle();
    const e = existing as { orderId: string; amount: number; currency: string } | null;
    if (e) {
      return NextResponse.json({
        orderId: e.orderId, amount: e.amount, currency: e.currency,
        keyId: getPublicKeyId(), reused: true,
      });
    }
  }

  const order = await createRazorpayOrder({
    amount,
    receipt: `wallet_${user.id}_${Date.now()}`,
    notes: { userId: user.id, purpose: "wallet_topup", idempotencyKey: idemKey },
  });

  await admin.from("RazorpayPayment").insert({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    status: "created",
    userId: user.id,
    purpose: "wallet_topup",
    metadata: { idempotencyKey: idemKey || null },
  } as never);

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: getPublicKeyId(),
  });
}
