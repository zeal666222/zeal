// ZEAL_FIX_PULSE_V3
// Consultant dashboard pulse — bearer + cookie aware.
import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";
import { evaluateConsultantProfile } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const { data: consultant } = await admin
    .from("Consultant")
    .select(`id, bio, "perMinuteRate", specialties, languages, availability,
             category, status, "isActive", rating, "totalConsultations",
             "sparkScore", subdomain`)
    .eq("userId", userId)
    .maybeSingle();

  if (!consultant) {
    return NextResponse.json({ error: "NO_CONSULTANT_PROFILE" }, { status: 404 });
  }
  const c = consultant as { id: string };

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const [userRow, wallet, todaysBookings, pending, live] = await Promise.all([
    admin.from("User").select("id, name, is_online, avatar_url").eq("id", userId).maybeSingle(),
    admin.from("Wallet").select("balance, escrow, pendingIn, pendingOut, blocked").eq("userId", userId).maybeSingle(),
    admin
      .from("Booking")
      .select("id, scheduledAt, durationMinutes, status, amount, userId")
      .eq("consultantId", c.id)
      .gte("scheduledAt", todayStart.toISOString())
      .lte("scheduledAt", todayEnd.toISOString())
      .order("scheduledAt", { ascending: true })
      .limit(20),
    admin.from("Booking").select("*", { count: "exact", head: true })
      .eq("consultantId", c.id).eq("status", "PENDING"),
    admin.from("CallSession").select("*", { count: "exact", head: true })
      .eq("consultantId", c.id).eq("status", "INITIATED"),
  ]);

  return NextResponse.json({
    consultant: {
      ...(consultant as Record<string, unknown>),
      ...((userRow.data ?? {}) as Record<string, unknown>),
      wallet: wallet.data ?? { balance: 0, escrow: 0, pendingIn: 0, pendingOut: 0, blocked: 0 },
      completeness: evaluateConsultantProfile(consultant),
    },
    today: {
      bookings: todaysBookings.data ?? [],
      pendingRequests: pending.count ?? 0,
      liveSessions: live.count ?? 0,
    },
  });
}
