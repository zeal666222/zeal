// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/users/[id]/preview — Profile preview for impersonation
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { id } = await params;

  // Fetch user profile
  const { data: user } = await admin
    .from("User")
    .select("id, email, name, username, role, avatar, createdAt, is_online")
    .eq("id", id)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch recent messages (last 5)
  const { data: recentMessages } = await admin
    .from("Message")
    .select("content, createdAt")
    .eq("senderId", id)
    .order("createdAt", { ascending: false })
    .limit(5);

  // Last live session. There is no ConsultingSession table — CallSession is what
  // the chat/call worker actually writes. durationSeconds → minutes because that
  // is the unit the impersonation preview renders.
  const { data: lastSessions } = await admin
    .from("CallSession")
    .select("id, startTime, durationSeconds")
    .eq("userId", id)
    .order("startTime", { ascending: false })
    .limit(1);

  // Fetch last booking
  const { data: lastBookings } = await admin
    .from("Booking")
    .select("id, createdAt, status")
    .eq("userId", id)
    .order("createdAt", { ascending: false })
    .limit(1);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    role: user.role,
    avatar: user.avatar,
    createdAt: user.createdAt,
    is_online: user.is_online,
    recentMessages: (recentMessages ?? []).map((m: Record<string, unknown>) => ({
      content: m.content,
      createdAt: m.createdAt,
    })),
    lastSession: lastSessions?.[0]
      ? {
          id: lastSessions[0].id,
          createdAt: lastSessions[0].startTime,
          duration: Math.round(((lastSessions[0].durationSeconds ?? 0) as number) / 60),
        }
      : null,
    lastBooking: lastBookings?.[0] ?? null,
  });
}
