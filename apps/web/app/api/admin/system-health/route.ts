import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth/api-guard";
import { withErrorHandler } from "@/lib/errors";
import { createAdminClient } from "@zeal/database/server";
import { getPoolManager } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async () => {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const admin = createAdminClient();

  const [
    activeUsersRes, activeSessionsRes, walletBalanceRes,
    recentErrorsRes, billingAnomaliesRes,
    aiConsultantsRes, todayBookingsRes,
  ] = await Promise.allSettled([
    admin.from("User").select("id", { count: "exact", head: true }).eq("is_online", true),
    admin.from("CallSession").select("id", { count: "exact", head: true }).in("status", ["CONNECTED", "ACTIVE"]),
    admin.from("Wallet").select("balance, escrow, pendingIn, pendingOut, blocked"),
    // AdminAuditLog timestamps are camelCase in this schema — `created_at` made
    // the whole select fail, so the errors panel always rendered empty.
    admin.from("AdminAuditLog").select("id, action_name, metadata, createdAt")
      .eq("success", false)
      .gte("createdAt", new Date(Date.now() - 86400000).toISOString())
      .order("createdAt", { ascending: false }).limit(10),
    admin.from("Wallet").select("userId, balance").lt("balance", 0).limit(20),
    admin.from("AIConsultant").select("id, name, isActive", { count: "exact", head: false }),
    admin.from("Booking").select("id", { count: "exact", head: true })
      .gte("createdAt", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ]);

  const activeUsers = activeUsersRes.status === "fulfilled" ? (activeUsersRes.value.count ?? 0) : 0;
  const activeSessions = activeSessionsRes.status === "fulfilled" ? (activeSessionsRes.value.count ?? 0) : 0;

  let treasury = { totalBalance: 0, totalEscrow: 0, totalPendingIn: 0, totalPendingOut: 0, totalBlocked: 0, walletCount: 0 };
  if (walletBalanceRes.status === "fulfilled" && walletBalanceRes.value.data) {
    const wallets = walletBalanceRes.value.data as Record<string, number>[];
    treasury.walletCount = wallets.length;
    for (const w of wallets) {
      treasury.totalBalance += w.balance ?? 0;
      treasury.totalEscrow += w.escrow ?? 0;
      treasury.totalPendingIn += w.pendingIn ?? 0;
      treasury.totalPendingOut += w.pendingOut ?? 0;
      treasury.totalBlocked += w.blocked ?? 0;
    }
  }

  const recentErrors = recentErrorsRes.status === "fulfilled" ? (recentErrorsRes.value.data ?? []) : [];
  const negativeBalances = billingAnomaliesRes.status === "fulfilled" ? (billingAnomaliesRes.value.data ?? []) : [];
  const dbPool = getPoolManager().getStats();

  const aiConsultants = aiConsultantsRes.status === "fulfilled"
    ? {
        total: aiConsultantsRes.value.count ?? 0,
        active: ((aiConsultantsRes.value.data ?? []) as Record<string, unknown>[]).filter((c) => c.isActive).length,
      }
    : { total: 0, active: 0 };

  const todayBookings = todayBookingsRes.status === "fulfilled" ? (todayBookingsRes.value.count ?? 0) : 0;

  return NextResponse.json({
    activeUsers, activeSessions, treasury,
    recentErrors: (recentErrors as Record<string, unknown>[]).slice(0, 5),
    negativeBalances: (negativeBalances as Record<string, unknown>[]).length,
    dbPool, aiConsultants, todayBookings,
    timestamp: new Date().toISOString(),
  });
});
