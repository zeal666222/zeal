// apps/admin/app/api/consultant/bookings/route.ts
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";

export const dynamic = "force-dynamic";

interface BookingRow {
  id: string; scheduledAt: string; durationMinutes: number;
  status: string; amount: number; userId: string | null;
}
interface UserRow { id: string; name: string | null; username: string | null }

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: consultant } = await supabase
    .from("Consultant").select("id").eq("userId", user.id).maybeSingle();
  if (!consultant) return NextResponse.json({ bookings: [] });

  const { data: bookingsRaw, error } = await supabase
    .from("Booking")
    .select("id, scheduledAt, durationMinutes, status, amount, userId")
    .eq("consultantId", consultant.id)
    .order("scheduledAt", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bookings = (bookingsRaw ?? []) as BookingRow[];
  const ids = Array.from(new Set(bookings.map((b) => b.userId).filter((x): x is string => Boolean(x))));

  let users: UserRow[] = [];
  if (ids.length > 0) {
    const { data } = await supabase.from("User").select("id, name, username").in("id", ids);
    users = (data ?? []) as UserRow[];
  }
  const userById = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      scheduledAt: b.scheduledAt,
      durationMinutes: b.durationMinutes,
      status: b.status,
      amount: b.amount,
      userName: b.userId
        ? (userById.get(b.userId)?.name || userById.get(b.userId)?.username || null)
        : null,
    })),
  });
}
