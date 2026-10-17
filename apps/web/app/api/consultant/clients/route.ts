import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";
import { withErrorHandler } from "@/lib/errors";
import { safeQuery, safeQueryOne } from "@/lib/infra/guards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BookingRow { userId: string | null; scheduledAt: string }
interface UserRow { id: string; name: string | null; username: string | null; email: string | null }

export const GET = withErrorHandler(async () => {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const consultant = await safeQueryOne<{ id: string }>(
    admin.from("Consultant").select("id").eq("userId", userId).maybeSingle(),
    "clients.consultant",
  );
  if (!consultant) return NextResponse.json({ clients: [] });

  const bookings = await safeQuery<BookingRow[]>(
    admin.from("Booking")
      .select("userId, scheduledAt")
      .eq("consultantId", consultant.id)
      .not("userId", "is", null)
      .order("scheduledAt", { ascending: false }),
    "clients.bookings",
  );

  const stats = new Map<string, { sessions: number; lastSessionAt: string }>();
  for (const b of (bookings ?? [])) {
    if (!b.userId) continue;
    const existing = stats.get(b.userId);
    if (existing) {
      existing.sessions += 1;
      if (b.scheduledAt > existing.lastSessionAt) existing.lastSessionAt = b.scheduledAt;
    } else {
      stats.set(b.userId, { sessions: 1, lastSessionAt: b.scheduledAt });
    }
  }

  const ids = Array.from(stats.keys());
  if (ids.length === 0) return NextResponse.json({ clients: [] });

  const users = await safeQuery<UserRow[]>(
    admin.from("User").select("id, name, username, email").in("id", ids),
    "clients.users",
  );

  const clients = (users ?? []).map((u) => {
    const s = stats.get(u.id);
    return {
      id: u.id, name: u.name || u.username || null, email: u.email,
      lastSessionAt: s?.lastSessionAt ?? null, sessions: s?.sessions ?? 0,
    };
  });

  return NextResponse.json({ clients });
});
