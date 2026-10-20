// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/consultants/analytics
// Real per-consultant performance rollup so the analytics table reports actual
// numbers (completed sessions, settled earnings, live rating, booking trend)
// instead of the Math.random() placeholders it used to fabricate.
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth/api-guard";
import { safeQuery } from "@/lib/infra/guards";

export const dynamic = "force-dynamic";

const SETTLED = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"];

interface BookingRow {
  consultantId: string | null;
  status: string;
  consultantEarning: number | null;
  createdAt: string | null;
}

export async function GET() {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const [consultantsRes, bookingsRes] = await Promise.all([
    admin
      .from("Consultant")
      .select("id, rating, totalConsultations, user:User!userId(id, name, username, avatar_url)")
      .order("createdAt", { ascending: false })
      .limit(200),
    safeQuery<BookingRow[]>(
      admin
        .from("Booking")
        .select("consultantId, status, consultantEarning, createdAt")
        .in("status", SETTLED),
      "admin.consultants.analytics.bookings",
    ),
  ]);

  if (consultantsRes.error) {
    return NextResponse.json({ error: consultantsRes.error.message }, { status: 500 });
  }

  const now = Date.now();
  const DAY = 86_400_000;
  const agg = new Map<string, { completed: number; revenue: number; last30: number; prior30: number }>();
  for (const b of bookingsRes ?? []) {
    if (!b.consultantId) continue;
    const a = agg.get(b.consultantId) ?? { completed: 0, revenue: 0, last30: 0, prior30: 0 };
    if (b.status === "COMPLETED") a.completed += 1;
    a.revenue += Number(b.consultantEarning ?? 0);
    if (b.createdAt) {
      const age = (now - new Date(b.createdAt).getTime()) / DAY;
      if (age <= 30) a.last30 += 1;
      else if (age <= 60) a.prior30 += 1;
    }
    agg.set(b.consultantId, a);
  }

  const rows = ((consultantsRes.data ?? []) as unknown[]).map((raw) => {
    const c = raw as unknown as {
      id: string;
      rating: number | null;
      totalConsultations: number | null;
      user: { name: string | null; username: string | null; avatar_url: string | null } | null;
    };
    const a = agg.get(c.id);
    const last30 = a?.last30 ?? 0;
    const prior30 = a?.prior30 ?? 0;
    return {
      id: c.id,
      name: c.user?.name ?? c.user?.username ?? "Unknown",
      avatar: c.user?.avatar_url ?? null,
      sessionsCompleted: a?.completed ?? 0,
      revenue: Math.round((a?.revenue ?? 0) * 100) / 100,
      rating: Number(c.rating ?? 0),
      avgResponseTime: null as number | null, // requires Message-table latency rollup
      trend: (last30 > prior30 ? "up" : last30 < prior30 ? "down" : "stable") as "up" | "down" | "stable",
    };
  });

  const n = rows.length || 1;
  return NextResponse.json({
    consultants: rows,
    averages: {
      sessions: rows.reduce((s, r) => s + r.sessionsCompleted, 0) / n,
      revenue: rows.reduce((s, r) => s + r.revenue, 0) / n,
      rating: rows.reduce((s, r) => s + r.rating, 0) / n,
    },
  });
}
