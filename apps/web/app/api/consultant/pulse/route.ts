import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";
import { withErrorHandler } from "@/lib/errors";
import { safeQuery, safeQueryOne } from "@/lib/infra/guards";
import { evaluateConsultantProfile } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withErrorHandler(async () => {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const consultant = await safeQueryOne<{
    id: string; bio: string | null; perMinuteRate: number; specialties: string[] | null;
    languages: string[] | null; availability: unknown; category: string; status: string;
    isActive: boolean; rating: number; totalConsultations: number; sparkScore: number; subdomain: string | null;
  }>(
    admin.from("Consultant")
      .select(`id, bio, "perMinuteRate", specialties, languages, availability,
               category, status, "isActive", rating, "totalConsultations",
               "sparkScore", subdomain`)
      .eq("userId", userId)
      .maybeSingle(),
    "consultant.pulse",
  );

  if (!consultant) {
    return NextResponse.json({ error: "NO_CONSULTANT_PROFILE" }, { status: 404 });
  }

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const [userRow, wallet, todaysBookings, pending, live] = await Promise.all([
    safeQueryOne<{ id: string; name: string | null; is_online: boolean; avatar_url: string | null }>(
      admin.from("User").select("id, name, is_online, avatar_url").eq("id", userId).maybeSingle(),
      "pulse.user",
    ),
    safeQueryOne<{ balance: number; escrow: number; pendingIn: number; pendingOut: number; blocked: number }>(
      admin.from("Wallet").select("balance, escrow, pendingIn, pendingOut, blocked").eq("userId", userId).maybeSingle(),
      "pulse.wallet",
    ),
    safeQuery<Array<{ id: string; scheduledAt: string; durationMinutes: number; status: string; amount: number; userId: string }>>(
      admin.from("Booking")
        .select("id, scheduledAt, durationMinutes, status, amount, userId")
        .eq("consultantId", consultant.id)
        .gte("scheduledAt", todayStart.toISOString())
        .lte("scheduledAt", todayEnd.toISOString())
        .order("scheduledAt", { ascending: true })
        .limit(20),
      "pulse.todaysBookings",
    ),
    admin.from("Booking").select("*", { count: "exact", head: true })
      .eq("consultantId", consultant.id).eq("status", "PENDING"),
    admin.from("CallSession").select("*", { count: "exact", head: true })
      .eq("consultantId", consultant.id).eq("status", "INITIATED"),
  ]);

  return NextResponse.json({
    consultant: {
      ...(consultant as Record<string, unknown>),
      ...((userRow ?? {}) as Record<string, unknown>),
      wallet: wallet ?? { balance: 0, escrow: 0, pendingIn: 0, pendingOut: 0, blocked: 0 },
      completeness: evaluateConsultantProfile(consultant),
    },
    today: {
      bookings: todaysBookings ?? [],
      pendingRequests: pending.count ?? 0,
      liveSessions: live.count ?? 0,
    },
  });
});
