import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";
import { withErrorHandler } from "@/lib/errors";
import { safeQuery, safeQueryOne } from "@/lib/infra/guards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BookingRow {
  id: string; scheduledAt: string; durationMinutes: number;
  status: string; amount: number; userId: string | null;
}
interface UserRow { id: string; name: string | null; username: string | null }

export const GET = withErrorHandler(async () => {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const consultant = await safeQueryOne<{ id: string }>(
    admin.from("Consultant").select("id").eq("userId", userId).maybeSingle(),
    "bookings.consultant",
  );
  if (!consultant) return NextResponse.json({ bookings: [] });

  const bookings = await safeQuery<BookingRow[]>(
    admin.from("Booking")
      .select("id, scheduledAt, durationMinutes, status, amount, userId")
      .eq("consultantId", consultant.id)
      .order("scheduledAt", { ascending: false })
      .limit(100),
    "bookings.list",
  );

  const ids = Array.from(
    new Set((bookings ?? []).map((b) => b.userId).filter((x): x is string => Boolean(x))),
  );

  let users: UserRow[] = [];
  if (ids.length > 0) {
    users = (await safeQuery<UserRow[]>(
      admin.from("User").select("id, name, username").in("id", ids),
      "bookings.users",
    )) ?? [];
  }

  const userById = new Map<string, UserRow>();
  for (const u of users) userById.set(u.id, u);

  const items = (bookings ?? []).map((b) => {
    const u = b.userId ? userById.get(b.userId) : undefined;
    return {
      id: b.id, scheduledAt: b.scheduledAt, durationMinutes: b.durationMinutes,
      status: b.status, amount: b.amount, userName: u?.name || u?.username || null,
    };
  });

  return NextResponse.json({ bookings: items });
});
