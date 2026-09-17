import { NextResponse } from "next/server";
import { createServerClientFromCookies, getAdminClient } from "@zeal/database";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async () => {
  const supabase = getAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "SUPER_ADMIN") {
    throw new AppError("Forbidden", 403, ErrorCode.AUTH_FORBIDDEN);
  }

  const admin = getAdminClient();
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    users, consultants, bookings, revenueToday, revenueMonth,
    liveSessions, pendingVerifications, unreadNotifications,
  ] = await Promise.all([
    admin.from("User").select("*", { count: "exact", head: true }),
    admin.from("Consultant").select("*", { count: "exact", head: true }).eq("status", "VERIFIED").eq("isActive", true),
    admin.from("Booking").select("*", { count: "exact", head: true }),
    admin.from("Transaction").select("amount").eq("type", "PAYMENT").gte("createdAt", startOfDay.toISOString()),
    admin.from("Transaction").select("amount").eq("type", "PAYMENT").gte("createdAt", startOfMonth.toISOString()),
    admin.from("CallSession").select("*", { count: "exact", head: true }).eq("status", "INITIATED"),
    admin.from("Consultant").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
    admin.from("Notification").select("*", { count: "exact", head: true }).eq("read", false),
  ]);

  const sum = (arr: unknown[] | null) => (arr || []).reduce((a: number, r: any) => a + Math.abs(Number(r.amount) || 0), 0);

  return NextResponse.json({
    users: users.count || 0,
    consultants: consultants.count || 0,
    bookings: bookings.count || 0,
    revenueToday: sum(revenueToday.data),
    revenueMonth: sum(revenueMonth.data),
    liveSessions: liveSessions.count || 0,
    pendingVerifications: pendingVerifications.count || 0,
    unreadNotifications: unreadNotifications.count || 0,
  });
});
