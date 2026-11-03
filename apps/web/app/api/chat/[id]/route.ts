import { NextResponse } from "next/server";
import {createServerClientFromCookies} from "@zeal/database/server";
import {getUserId} from "@/lib/auth";
import {withErrorHandler, AppError, ErrorCode} from "@/lib/errors";
import {isAiConversationId} from "@/lib/chat/conversation-id";
import {resolveWorkerAuth} from "@/lib/auth/access-token";
import {WORKER_URL} from "@/lib/chat/worker";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await getUserId();
    if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
    const { id } = await params;

    const supabase = await createServerClientFromCookies();

    // New unified chat: participants-based
    const { data: participant } = await supabase
      .from("ConversationParticipant")
      .select("conversationId, userId")
      .eq("conversationId", id)
      .eq("userId", userId)
      .maybeSingle();

    if (!participant) throw new AppError("Conversation not found", 404, ErrorCode.NOT_FOUND);

    const { data: partners } = await supabase
      .from("ConversationParticipant")
      .select("userId")
      .eq("conversationId", id)
      .neq("userId", userId)
      .limit(1);

    const partnerId = partners?.[0]?.userId ?? null;
    let otherUser = null;
    if (partnerId) {
      const { data: u } = await supabase
        .from("User")
        .select("id, name, username, avatar, role")
        .eq("id", partnerId)
        .maybeSingle();
      otherUser = u;
    }

    const { data: conversation } = await supabase
      .from("Conversation")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    return NextResponse.json({ conversation, otherUser });
  },
);

export const DELETE = withErrorHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await getUserId();
    if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
    const { id } = await params;

    // AI conversations live on the Cloudflare worker
    if (isAiConversationId(id)) {
      const auth = await resolveWorkerAuth();
      if (!auth.accessToken) {
        throw new AppError("Worker auth failed", 503, ErrorCode.AI_SERVICE_UNAVAILABLE);
      }

      const workerUrl = `${WORKER_URL}/api/conversations/${id}`;
      const workerRes = await fetch(workerUrl, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });

      if (!workerRes.ok) {
        const text = await workerRes.text().catch(() => "");
        throw new AppError(
          text || `Worker returned ${workerRes.status}`,
          workerRes.status,
          ErrorCode.INTERNAL_SERVER,
        );
      }

      return NextResponse.json({ success: true });
    }

    // Human conversations live on Supabase
    const supabase = await createServerClientFromCookies();

    // Verify the user is a participant
    const { data: participant } = await supabase
      .from("ConversationParticipant")
      .select("conversationId")
      .eq("conversationId", id)
      .eq("userId", userId)
      .maybeSingle();

    if (!participant) {
      throw new AppError("Conversation not found", 404, ErrorCode.NOT_FOUND);
    }

    // Delete messages
    await supabase.from("Message").delete().eq("conversationId", id);

    // Delete participants
    await supabase.from("ConversationParticipant").delete().eq("conversationId", id);

    // Delete the conversation
    await supabase.from("Conversation").delete().eq("id", id);

    return NextResponse.json({ success: true });
  },
);
