// apps/web/app/api/wallet/webhooks/instamojo/route.ts
// Razorpay webhook — raw body + timing-safe HMAC + idempotent event log.
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RazorpayPaymentEntity {
  id: string;
  order_id: string | null;
  status: string;
  amount: number;
  currency: string;
  notes?: Record<string, string>;
}
interface RazorpayWebhookBody {
  id: string;
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
    order?: { entity: { id: string; notes?: Record<string, string> } };
    refund?: { entity: { id: string; payment_id: string; amount: number; status: string } };
  };
}

function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(rawBody) as RazorpayWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("RazorpayWebhookEvent")
    .select("id")
    .eq("id", body.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, skipped: true, event: body.event });

  await admin.from("RazorpayWebhookEvent").insert({
    id: body.id,
    event: body.event,
    payload: body.payload as never,
    processed: false,
  } as never);

  try {
    if (body.event === "payment.captured" || body.event === "order.paid") {
      const payment = body.payload.payment?.entity;
      const orderNotes = body.payload.order?.entity?.notes ?? {};
      const notes = payment?.notes ?? orderNotes;
      const userId = notes.userId;
      const purpose = notes.purpose;
      const referenceId = notes.bookingId;

      if (userId && payment) {
        const amountRupees = payment.amount / 100;

        if (purpose === "wallet_topup") {
          await admin.rpc("credit_funds_safe", {
            p_user_id: userId,
            p_amount: amountRupees,
            p_description: `Razorpay top-up ${payment.id}`,
            p_reference_id: payment.id,
          });
          await admin
            .from("RazorpayPayment")
            .update({
              paymentId: payment.id,
              status: "captured",
              updatedAt: new Date().toISOString(),
            } as never)
            .eq("orderId", payment.order_id ?? "");
        } else if (purpose === "booking_payment" && referenceId) {
          await admin.rpc("confirm_booking_payment", {
            p_booking_id: referenceId,
            p_razorpay_payment_id: payment.id,
          });
          await admin
            .from("RazorpayPayment")
            .update({
              paymentId: payment.id,
              status: "captured",
              referenceId,
              updatedAt: new Date().toISOString(),
            } as never)
            .eq("orderId", payment.order_id ?? "");
        }
      }
    } else if (body.event === "payment.failed") {
      const payment = body.payload.payment?.entity;
      if (payment?.order_id) {
        await admin
          .from("RazorpayPayment")
          .update({ status: "failed", updatedAt: new Date().toISOString() } as never)
          .eq("orderId", payment.order_id);
      }
    } else if (body.event === "refund.processed") {
      const refund = body.payload.refund?.entity;
      if (refund?.payment_id) {
        await admin
          .from("RazorpayPayment")
          .update({ status: "refunded", updatedAt: new Date().toISOString() } as never)
          .eq("paymentId", refund.payment_id);
      }
    }

    await admin
      .from("RazorpayWebhookEvent")
      .update({ processed: true, processedAt: new Date().toISOString() } as never)
      .eq("id", body.id);

    return NextResponse.json({ ok: true, event: body.event });
  } catch (err) {
    console.error("[razorpay-webhook] handler error:", err);
    return NextResponse.json({ ok: false, error: "Handler failed" }, { status: 500 });
  }
}
