import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

interface SessionRow {
  id: string;
  userId: string;
  consultantId: string | null;
  aiConsultantId: string | null;
  isAI: boolean;
  startTime: string;
  durationSeconds: number;
  amount: number;
}

export async function GET() {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { data: sessions, error } = await admin
    .from("CallSession")
    .select('id, "userId", "consultantId", "aiConsultantId", "isAI", "startTime", "durationSeconds", amount')
    .in("status", ["INITIATED", "CONNECTED"])
    .order("startTime", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (sessions ?? []) as SessionRow[];
  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const consultantIds = Array.from(new Set(rows.map((r) => r.consultantId).filter((x): x is string => Boolean(x))));
  const aiIds = Array.from(new Set(rows.map((r) => r.aiConsultantId).filter((x): x is string => Boolean(x))));

  const [usersRes, consultantsRes, aiRes] = await Promise.all([
    userIds.length
      ? admin.from("User").select("id, name, username").in("id", userIds)
      : Promise.resolve({ data: [] }),
    consultantIds.length
      ? admin.from("Consultant").select("id, perMinuteRate, user:User!Consultant_userId_fkey(name)").in("id", consultantIds)
      : Promise.resolve({ data: [] }),
    aiIds.length
      ? admin.from("AIConsultant").select('id, name, "perMinuteRate"').in("id", aiIds)
      : Promise.resolve({ data: [] }),
  ]);

  const userMap = new Map<string, string>();
  for (const u of (usersRes.data ?? []) as Array<{ id: string; name: string | null; username: string | null }>) {
    userMap.set(u.id, u.name ?? u.username ?? "User");
  }

  const consultantMap = new Map<string, { name: string; rate: number }>();
  for (const c of (consultantsRes.data ?? []) as Array<{
    id: string;
    perMinuteRate: number;
    user: { name: string | null } | { name: string | null }[] | null;
  }>) {
    const u = Array.isArray(c.user) ? c.user[0] : c.user;
    consultantMap.set(c.id, { name: u?.name ?? "Consultant", rate: Number(c.perMinuteRate ?? 0) });
  }

  const aiMap = new Map<string, { name: string; rate: number }>();
  for (const a of (aiRes.data ?? []) as Array<{ id: string; name: string; perMinuteRate: number }>) {
    aiMap.set(a.id, { name: a.name, rate: Number(a.perMinuteRate ?? 0) });
  }

  const items = rows.map((r) => {
    const isAI = r.isAI;
    const c = r.consultantId ? consultantMap.get(r.consultantId) : null;
    const a = r.aiConsultantId ? aiMap.get(r.aiConsultantId) : null;

    const elapsed = Math.floor((Date.now() - new Date(r.startTime).getTime()) / 1000);

    return {
      id: r.id,
      userId: r.userId,
      userName: userMap.get(r.userId) ?? "User",
      consultantId: r.consultantId,
      consultantName: isAI ? (a?.name ?? "AI") : (c?.name ?? "Consultant"),
      isAI,
      startTime: r.startTime,
      durationSeconds: elapsed,
      amount: Number(r.amount ?? 0),
      rate: isAI ? (a?.rate ?? 0) : (c?.rate ?? 0),
    };
  });

  return NextResponse.json({ items });
}
