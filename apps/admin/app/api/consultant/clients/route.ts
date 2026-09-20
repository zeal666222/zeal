// apps/admin/app/api/consultant/clients/route.ts
import {NextResponse} from "next/server";
import {createServerClientFromCookies} from "@zeal/database/server";

export const dynamic = "force-dynamic";

interface BookingRow { userId: string | null; scheduledAt: string }
interface UserRow { id: string; name: string | null; username: string | null; email: string | null }

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: consultant } = await supabase
    .from("Consultant").select("id").eq("userId", user.id).maybeSingle();
  if (!consultant) return NextResponse.json({ clients: [] });

  const { data: bookingsRaw } = await supabase
    .from("Booking")
    .select("userId, scheduledAt")
    .eq("consultantId", consultant.id)
    .not("userId", "is", null)
    .order("scheduledAt", { ascending: false });

  const bookings = (bookingsRaw ?? []) as BookingRow[];
  const stats = new Map<string, { sessions: number; lastSessionAt: string }>();
  for (const b of bookings) {
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

  const { data: usersRaw } = await supabase
    .from("User").select("id, name, username, email").in("id", ids);
  const users = (usersRaw ?? []) as UserRow[];

  return NextResponse.json({
    clients: users.map((u) => ({
      id: u.id,
      name: u.name || u.username || null,
      email: u.email,
      lastSessionAt: stats.get(u.id)?.lastSessionAt ?? null,
      sessions: stats.get(u.id)?.sessions ?? 0,
    })),
  });
}
