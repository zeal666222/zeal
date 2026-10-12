// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/system-health — Real-time platform health metrics
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth/api-guard";
import { createAdminClient } from "@zeal/database/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const admin = createAdminClient();

  try {
    // Run all queries in parallel
    const [
      activeUsersRes,
      activeSessionsRes,
      walletBalanceRes,
      recentErrorsRes,
      billingAnomaliesRes,
      dbPoolRes,
      aiConsultantsRes,
      todayBookingsRes,
    ] = await Promise.allSettled([
      // Active users (online in last 5 min)
      admin
        .from("User")
        .select("id", { count: "exact", head: true })
        .eq("is_online", true),

      // Active sessions (live consultations)
      admin.rpc("live_sessions_count").single(),

      // Total wallet balance across all users
      admin
        .from("Wallet")
        .select("balance, escrow, pendingIn, pendingOut, blocked"),

      // Recent errors from audit log (last 24h)
      admin
        .from("AdminAuditLog")
        .select("id, action_name, metadata, created_at")
        .eq("success", false)
        .gte("created_at", new Date(Date.now() - 86400000).toISOString())
        .order("created_at", { ascending: false })
        .limit(10),

      // Billing anomalies: sessions running > 2 hours or negative balances
      admin
        .from("Wallet")
        .select("userId, balance")
        .lt("balance", 0)
        .limit(20),

      // DB connection pool (pg_stat)
      admin.rpc("get_db_pool_stats").single(),

      // AI consultant stats
      admin
        .from("AIConsultant")
        .select("id, name, isActive", { count: "exact", head: false }),

      // Today's bookings count
      admin
        .from("Booking")
        .select("id", { count: "exact", head: true })
        .gte("createdAt", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    ]);

  // Process results
  const activeUsers = activeUsersRes.status === "fulfilled"
    ? (activeUsersRes.value.count ?? 0)
    : 0;

  const activeSessions = activeSessionsRes.status === "fulfilled"
    ? ((activeSessionsRes.value.data as number) ?? 0)
    : 0;

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

  const recentErrors = recentErrorsRes.status === "fulfilled"
    ? (recentErrorsRes.value.data ?? [])
    : [];

  const negativeBalances = billingAnomaliesRes.status === "fulfilled"
    ? (billingAnomaliesRes.value.data ?? [])
    : [];

  const dbPool = dbPoolRes.status === "fulfilled"
    ? (dbPoolRes.value.data as Record<string, unknown> ?? {})
    : {};

  const aiConsultants = aiConsultantsRes.status === "fulfilled"
    ? {
        total: aiConsultantsRes.value.count ?? 0,
        active: ((aiConsultantsRes.value.data ?? []) as Record<string, unknown>[]).filter(
          (c) => c.isActive
        ).length,
      }
    : { total: 0, active: 0 };

  const todayBookings = todayBookingsRes.status === "fulfilled"
    ? (todayBookingsRes.value.count ?? 0)
    : 0;

  return NextResponse.json({
    activeUsers,
    activeSessions,
    treasury,
    recentErrors: (recentErrors as Record<string, unknown>[]).slice(0, 5),
    negativeBalances: (negativeBalances as Record<string, unknown>[]).length,
    dbPool,
    aiConsultants,
    todayBookings,
    timestamp: new Date().toISOString(),
  });
  } catch (err) {
    console.error("[system-health]", err);
    return NextResponse.json(
      { error: "Failed to fetch system health" },
      { status: 500 },
    );
  }
}
