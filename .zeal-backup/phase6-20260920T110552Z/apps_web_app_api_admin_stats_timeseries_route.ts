// apps/web/app/api/admin/stats/timeseries/route.ts
import { NextResponse } from "next/server";
import {createAdminClient} from "@zeal/database/server";
import {withErrorHandler, AppError, ErrorCode} from "@/lib/errors";
import {requireRole} from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

interface TimeseriesPoint {
  day: string;
  revenue: number;
  bookings: number;
}

export const GET = withErrorHandler(async (req: Request) => {
  await requireRole("SUPPORT");

  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30", 10), 1), 90);

  const admin = createAdminClient();

  // Prefer RPC (single round-trip, indexed aggregates)
  const { data: rpcData, error: rpcError } = await admin.rpc("admin_timeseries", { p_days: days });

  if (!rpcError && Array.isArray(rpcData)) {
    return NextResponse.json({ series: rpcData, source: "rpc" });
  }

  // Fallback: compute in JS if RPC not applied yet
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const [txRes, bkRes] = await Promise.all([
    admin
      .from("Transaction")
      .select("amount, createdAt")
      .eq("type", "PAYMENT")
      .gte("createdAt", since.toISOString()),
    admin
      .from("Booking")
      .select("createdAt")
      .gte("createdAt", since.toISOString()),
  ]);

  if (txRes.error) throw new AppError(txRes.error.message, 500, ErrorCode.INTERNAL_SERVER);
  if (bkRes.error) throw new AppError(bkRes.error.message, 500, ErrorCode.INTERNAL_SERVER);

  const revenueByDay = new Map<string, number>();
  const bookingsByDay = new Map<string, number>();

  for (const t of (txRes.data ?? []) as Array<{ amount: number; createdAt: string }>) {
    const day = t.createdAt.slice(0, 10);
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + Number(t.amount || 0));
  }
  for (const b of (bkRes.data ?? []) as Array<{ createdAt: string }>) {
    const day = b.createdAt.slice(0, 10);
    bookingsByDay.set(day, (bookingsByDay.get(day) ?? 0) + 1);
  }

  const series: TimeseriesPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    series.push({
      day: key,
      revenue: revenueByDay.get(key) ?? 0,
      bookings: bookingsByDay.get(key) ?? 0,
    });
  }

  return NextResponse.json({ series, source: "fallback" });
});
