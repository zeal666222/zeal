import {NextResponse} from "next/server";
import {requireAdminAPI} from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

interface Point { day: string; revenue: number; bookings: number }

export async function GET(req: Request) {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;
  const {admin} = guard;

  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30", 10), 1), 90);

  const {data: rpcData, error: rpcError} = await admin.rpc("admin_timeseries", {p_days: days});
  if (!rpcError && Array.isArray(rpcData)) {
    return NextResponse.json({series: rpcData, source: "rpc"});
  }

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const [txRes, bkRes] = await Promise.all([
    admin.from("Transaction").select("amount, createdAt").eq("type", "PAYMENT").gte("createdAt", since.toISOString()),
    admin.from("Booking").select("createdAt").gte("createdAt", since.toISOString()),
  ]);

  const revByDay = new Map<string, number>();
  const bkByDay = new Map<string, number>();

  for (const t of (txRes.data ?? []) as Array<{amount: number; createdAt: string}>) {
    const day = t.createdAt.slice(0, 10);
    revByDay.set(day, (revByDay.get(day) ?? 0) + Number(t.amount || 0));
  }
  for (const b of (bkRes.data ?? []) as Array<{createdAt: string}>) {
    const day = b.createdAt.slice(0, 10);
    bkByDay.set(day, (bkByDay.get(day) ?? 0) + 1);
  }

  const series: Point[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    series.push({
      day: key,
      revenue: revByDay.get(key) ?? 0,
      bookings: bkByDay.get(key) ?? 0,
    });
  }

  return NextResponse.json({series, source: "fallback"});
}
