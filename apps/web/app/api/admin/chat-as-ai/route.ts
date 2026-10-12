// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/chat-as-ai — Send a message AS an AI consultant
// ═══════════════════════════════════════════════════════════════════════════════
// When a super admin is impersonating an AI consultant, this endpoint lets them
// send messages directly as the AI — bypassing AI generation entirely.
// The message is inserted with the AI consultant's shadow userId as senderId.
// ═══════════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  consultantId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

export async function POST(req: Request) {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { conversationId, consultantId, content } = parsed.data;

  // Verify the AI consultant exists and get their shadow userId
  const { data: aiConsultant } = await admin
    .from("AIConsultant")
    .select("id, name, userId")
    .eq("id", consultantId)
    .maybeSingle();

  if (!aiConsultant) {
    return NextResponse.json({ error: "AI consultant not found" }, { status: 404 });
  }

  // Verify admin is a participant in this conversation (or the AI is)
  const { data: participant } = await admin
    .from("ConversationParticipant")
    .select("userId")
    .eq("conversationId", conversationId)
    .eq("userId", aiConsultant.userId as string)
    .maybeSingle();

  if (!participant) {
    return NextResponse.json(
      { error: "AI consultant is not a participant in this conversation" },
      { status: 403 },
    );
  }

  // Insert the message as the AI consultant's shadow user
  const { data: message, error } = await admin
    .from("Message")
    .insert({
      conversationId,
      senderId: aiConsultant.userId as string,
      content,
      type: "text",
    })
    .select("id, conversationId, senderId, content, type, createdAt")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  await logAdminAction(admin, {
    adminId,
    action: "CHAT_AS_AI",
    targetType: "ai_consultant",
    targetId: consultantId,
    metadata: {
      conversationId,
      contentLength: content.length,
      aiName: aiConsultant.name,
    },
  });

  return NextResponse.json({
    message,
    aiConsultant: {
      id: aiConsultant.id,
      name: aiConsultant.name,
    },
  });
}
