// apps/admin/app/api/consultant/pulse/route.ts
import { NextResponse } from "next/server";
import {
  createServerClientFromCookies,
  evaluateConsultantProfile,
} from "@zeal/database/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: consultant } = await supabase
    .from("Consultant")
    .select("id, bio, perMinuteRate, specialties, languages, availability, category, status, isActive, rating, totalConsultations, sparkScore, subdomain")
    .eq("userId", user.id)
    .maybeSingle();

  if (!consultant) return NextResponse.json({ error: "NO_CONSULTANT_PROFILE" }, { status: 404 });

  const [userRow, wallet, todaysBookings, pending, live] = await Promise.all([
    supabase.from("User").select("id, name, is_online, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.from("Wallet").select("balance, escrow, pendingIn, pendingOut, blocked").eq("userId", user.id).maybeSingle(),
    supabase.from("Booking")
      .select("id, scheduledAt, durationMinutes, status, amount, userId")
      .eq("consultantId", consultant.id)
      .gte("scheduledAt", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .lte("scheduledAt", new Date(new Date().setHours(23, 59, 59, 999)).toISOString())
      .order("scheduledAt", { ascending: true })
      .limit(20),
    supabase.from("Booking").select("*", { count: "exact", head: true })
      .eq("consultantId", consultant.id).eq("status", "PENDING"),
    supabase.from("CallSession").select("*", { count: "exact", head: true })
      .eq("consultantId", consultant.id).eq("status", "INITIATED"),
  ]);

  return NextResponse.json({
    consultant: {
      ...consultant,
      ...(userRow.data ?? {}),
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
