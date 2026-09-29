// apps/web/app/api/admin/stats/route.ts
// Adds treasury + Razorpay revenue snapshot.
import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

interface TreasuryRow {
  totalBalance?: number;
  totalEscrow?: number;
  totalPendingOut?: number;
  totalBlocked?: number;
  walletCount?: number;
}

export async function GET() {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const last24h = new Date(now.getTime() - 86_400_000).toISOString();

  const [
    usersRes, consultantsRes, bookingsRes,
    revenueTodayRes, revenueMonthRes,
    liveRes, pendingRes,
    treasuryRes, rzp24hRes,
  ] = await Promise.all([
    admin.from("User").select("*", { count: "exact", head: true }),
    admin.from("Consultant").select("*", { count: "exact", head: true }).eq("status", "VERIFIED"),
    admin.from("Booking").select("*", { count: "exact", head: true }),
    admin.from("Transaction").select("amount").eq("type", "PAYMENT").gte("createdAt", startOfDay.toISOString()),
    admin.from("Transaction").select("amount").eq("type", "PAYMENT").gte("createdAt", startOfMonth.toISOString()),
    admin.from("CallSession").select("*", { count: "exact", head: true }).eq("status", "INITIATED"),
    admin.from("Consultant").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
    admin.rpc("admin_treasury"),
    admin.from("RazorpayPayment").select("amount").eq("status", "captured").gte("createdAt", last24h),
  ]);

  const sum = (rows: Array<{ amount?: number }> | null | undefined): number =>
    (rows ?? []).reduce((acc, r) => acc + Math.abs(Number(r.amount ?? 0)), 0);

  const treasury = (treasuryRes.data as TreasuryRow | null) ?? {};
  const rzpRows = (rzp24hRes.data ?? []) as Array<{ amount?: number }>;
  const rzp24hRevenue = rzpRows.reduce((s, r) => s + Number(r.amount ?? 0), 0) / 100;

  return NextResponse.json({
    users: usersRes.count ?? 0,
    consultants: consultantsRes.count ?? 0,
    bookings: bookingsRes.count ?? 0,
    revenueToday: sum(revenueTodayRes.data as Array<{ amount?: number }> | null),
    revenueMonth: sum(revenueMonthRes.data as Array<{ amount?: number }> | null),
    liveSessions: liveRes.count ?? 0,
    pendingVerifications: pendingRes.count ?? 0,
    treasury: {
      totalBalance: Number(treasury.totalBalance ?? 0),
      totalEscrow: Number(treasury.totalEscrow ?? 0),
      totalPendingOut: Number(treasury.totalPendingOut ?? 0),
      totalBlocked: Number(treasury.totalBlocked ?? 0),
      walletCount: Number(treasury.walletCount ?? 0),
    },
    razorpay24hRevenue: rzp24hRevenue,
  });
}
