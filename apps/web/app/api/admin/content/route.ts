// ═══════════════════════════════════════════════════════════════════════════════
// Super Admin — Content Moderation Queue
// GET  /api/admin/content?severity=  → { posts: [...] } for the moderation page
// POST /api/admin/content            → { action: approve|reject|delete, ids[] }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

type Severity = "low" | "medium" | "high";

function deriveSeverity(p: { isFlagged?: boolean | null; isArchived?: boolean | null }): Severity {
  if (p.isFlagged) return "high";
  if (p.isArchived) return "medium";
  return "low";
}

// ─── GET — flagged / archived posts pending review ───────────────────────────
export async function GET(req: Request) {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const severity = new URL(req.url).searchParams.get("severity") ?? "all";

  const { data, error } = await admin
    .from("Post")
    .select('id, content, "mediaUrls", "isFlagged", "isArchived", createdAt, author:User!authorId(id, name, username, avatar)')
    .or("isFlagged.eq.true,isArchived.eq.true")
    .order("createdAt", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const posts = (data ?? [])
    .map((p: Record<string, unknown>) => {
      const sev = deriveSeverity({
        isFlagged: p.isFlagged as boolean | null,
        isArchived: p.isArchived as boolean | null,
      });
      const author = p.author as { name?: string; username?: string } | null;
      return {
        id: p.id,
        content: (p.content as string) ?? "",
        createdAt: p.createdAt,
        isFlagged: Boolean(p.isFlagged),
        isArchived: Boolean(p.isArchived),
        severity: sev,
        reason: p.isFlagged
          ? "Reported by users"
          : "Archived — pending review",
        reporter: author?.name || author?.username || "unknown",
      };
    })
    .filter((p: { severity: Severity }) => severity === "all" || p.severity === severity);

  return NextResponse.json({ posts });
}

// ─── POST — bulk moderation action ───────────────────────────────────────────
export async function POST(req: Request) {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  let body: { action?: unknown; ids?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 100)
    : [];

  if (!["approve", "reject", "delete"].includes(String(action)) || ids.length === 0) {
    return NextResponse.json({ error: "Invalid action or ids" }, { status: 400 });
  }

  let error: { message: string } | null = null;
  if (action === "delete") {
    ({ error } = await admin.from("Post").delete().in("id", ids));
  } else if (action === "approve") {
    // Clear the flag and put the post back in feeds
    ({ error } = await admin
      .from("Post")
      .update({ isFlagged: false, isArchived: false })
      .in("id", ids));
  } else {
    // reject — keep it out of feeds but retain for audit
    ({ error } = await admin
      .from("Post")
      .update({ isArchived: true })
      .in("id", ids));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const id of ids) {
    await logAdminAction(admin, {
      adminId,
      action: `content.moderation_${action}`,
      targetType: "post",
      targetId: id,
    });
  }

  return NextResponse.json({ success: true, action, count: ids.length });
}
