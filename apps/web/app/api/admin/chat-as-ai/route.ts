import { NextResponse } from "next/server";
import { requireAdminAPI, logAdminAction } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQuery, safeQueryOne } from "@/lib/infra/guards";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  consultantId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

export const POST = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin, userId: adminId } = guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Invalid request", 400, ErrorCode.VALIDATION_INPUT);
  }

  const { conversationId, consultantId, content } = parsed.data;

  // AIConsultant has no userId column — its id IS the auth user id, which is how
  // the row is seeded next to the "User" record. Asking for userId made this
  // lookup fail, so "Talk as AI" could never resolve a consultant.
  const aiConsultant = await safeQueryOne<{ id: string; name: string }>(
    admin.from("AIConsultant").select("id, name").eq("id", consultantId).maybeSingle(),
    "chat-as-ai.lookup",
  );
  if (!aiConsultant) throw new AppError("AI consultant not found", 404, ErrorCode.NOT_FOUND);

  const participant = await safeQueryOne<{ userId: string }>(
    admin.from("ConversationParticipant").select("userId")
      .eq("conversationId", conversationId).eq("userId", aiConsultant.id).maybeSingle(),
    "chat-as-ai.participant",
  );
  if (!participant) {
    throw new AppError("AI consultant is not a participant in this conversation", 403, ErrorCode.AUTH_FORBIDDEN);
  }

  const message = await safeQuery(
    admin.from("Message").insert({
      conversationId, senderId: aiConsultant.id, content, type: "text",
    }).select("id, conversationId, senderId, content, type, createdAt").single(),
    "chat-as-ai.insert",
  );

  await logAdminAction(admin, {
    adminId, action: "CHAT_AS_AI", targetType: "ai_consultant", targetId: consultantId,
    metadata: { conversationId, contentLength: content.length, aiName: aiConsultant.name },
  });

  return NextResponse.json({ message, aiConsultant: { id: aiConsultant.id, name: aiConsultant.name } });
});
