// ZEAL_FIX_BOOKINGS_V3
// Consultant bookings list — bearer + cookie aware.
import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BookingRow {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  amount: number;
  userId: string | null;
}
interface UserRow {
  id: string;
  name: string | null;
  username: string | null;
}

export async function GET() {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const { data: consultantRaw } = await admin
    .from("Consultant")
    .select("id")
    .eq("userId", userId)
    .maybeSingle();

  const consultant = consultantRaw as { id: string } | null;
  if (!consultant) {
    return NextResponse.json({ bookings: [] });
  }

  const { data: bookingsRaw, error } = await admin
    .from("Booking")
    .select("id, scheduledAt, durationMinutes, status, amount, userId")
    .eq("consultantId", consultant.id)
    .order("scheduledAt", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bookings = (bookingsRaw ?? []) as BookingRow[];

  const ids = Array.from(
    new Set(bookings.map((b) => b.userId).filter((x): x is string => Boolean(x))),
  );

  let users: UserRow[] = [];
  if (ids.length > 0) {
    const { data: usersRaw } = await admin
      .from("User")
      .select("id, name, username")
      .in("id", ids);
    users = (usersRaw ?? []) as UserRow[];
  }

  const userById = new Map<string, UserRow>();
  for (const u of users) userById.set(u.id, u);

  const items = bookings.map((b) => {
    const u = b.userId ? userById.get(b.userId) : undefined;
    return {
      id: b.id,
      scheduledAt: b.scheduledAt,
      durationMinutes: b.durationMinutes,
      status: b.status,
      amount: b.amount,
      userName: u?.name || u?.username || null,
    };
  });

  return NextResponse.json({ bookings: items });
}
