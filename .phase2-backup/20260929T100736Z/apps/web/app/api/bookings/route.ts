// apps/web/app/api/bookings/route.ts
// GET  /api/bookings?pendingPayment=true → abandoned checkouts
// POST /api/bookings → deprecated; bookings are created via /api/billing/instamojo
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const pendingOnly = url.searchParams.get("pendingPayment") === "true";

  let query = supabase
    .from("Booking")
    .select(`
      id, "scheduledAt", "durationMinutes", status, amount, "serviceType",
      "razorpayOrderId", "razorpayPaymentId", "paymentStatus",
      consultant:Consultant!consultantId(
        id, category,
        user:User!userId(name, username, avatar)
      )
    `)
    .eq("userId", user.id)
    .order("scheduledAt", { ascending: false })
    .limit(50);

  if (pendingOnly) query = query.eq("status", "PENDING_PAYMENT");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bookings: data ?? [] });
}

export async function POST() {
  return NextResponse.json(
    { error: "Use /api/billing/instamojo to create a booking" },
    { status: 410 },
  );
}
