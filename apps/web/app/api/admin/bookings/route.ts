import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth/api-guard";
import { withErrorHandler } from "@/lib/errors";
import { safeQuery } from "@/lib/infra/guards";

export const dynamic = "force-dynamic";

interface BookingRow { id: string; scheduledAt: string; status: string; amount: number; userId: string | null; consultantId: string }

export const GET = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const page = Math.max(parseInt(url.searchParams.get("page") || "1"), 1);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const from = (page - 1) * limit;

  let q = admin
    .from("Booking")
    .select("id, scheduledAt, status, amount, userId, consultantId", { count: "exact" })
    .order("scheduledAt", { ascending: false })
    .range(from, from + limit - 1);

  if (status && status !== "all") q = q.eq("status", status);

  const { data, error, count } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bookings = (data ?? []) as BookingRow[];
  const userIds = Array.from(new Set(bookings.map((b) => b.userId).filter((x): x is string => Boolean(x))));
  const consultantIds = Array.from(new Set(bookings.map((b) => b.consultantId)));

  const [usersRes, consultantsRes] = await Promise.all([
    userIds.length > 0
      ? safeQuery<Array<{ id: string; name?: string; username?: string; email?: string }>>(
          admin.from("User").select("id, name, username, email").in("id", userIds), "admin.bookings.users")
      : Promise.resolve([] as Array<{ id: string; name?: string; username?: string; email?: string }>),
    consultantIds.length > 0
      ? safeQuery<Array<{ id: string; user?: { name?: string; username?: string } | null | Array<{ name?: string; username?: string }> }>>(
          admin.from("Consultant").select("id, user:User!userId(name, username)").in("id", consultantIds), "admin.bookings.consultants")
      : Promise.resolve([] as Array<{ id: string; user?: { name?: string; username?: string } | null | Array<{ name?: string; username?: string }> }>),
  ]);

  const userById = new Map<string, { name?: string; username?: string; email?: string }>();
  for (const u of (usersRes ?? [])) userById.set(u.id, u);

  const consultantById = new Map<string, { name?: string }>();
  for (const c of (consultantsRes ?? [])) {
    const u = Array.isArray(c.user) ? c.user[0] : c.user;
    consultantById.set(c.id, { name: u?.name || u?.username });
  }

  const items = bookings.map((b) => ({
    id: b.id, scheduledAt: b.scheduledAt, status: b.status, amount: b.amount,
    user: b.userId ? { name: userById.get(b.userId)?.name || userById.get(b.userId)?.username || null, email: userById.get(b.userId)?.email ?? null } : null,
    consultant: { user: { name: consultantById.get(b.consultantId)?.name ?? null } },
  }));

  return NextResponse.json({ items, total: count ?? 0, page, limit, pages: Math.ceil((count ?? 0) / limit) });
});
