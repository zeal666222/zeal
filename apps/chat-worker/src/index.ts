import type { Env } from "./env";
import { validateJWT, extractBearer } from "./auth";
import { loadPersona } from "./persona-loader";
import { tryAcquire, release } from "./chat-concurrency";
import { startChatBilling } from "./billing";
import { handleAIChat, type CallAIResult, type AIMessage } from "./ai-chat-handler";
import { callAI } from "./ai-engine";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/api/health" && req.method === "GET") {
      return Response.json({ status: "ok", service: "zeal-chat", ts: new Date().toISOString() }, { headers: corsHeaders });
    }

    // AI Chat SSE endpoint
    const chatMatch = url.pathname.match(/^\/api\/chat\/ai\/([a-z0-9-]+)$/);
    if (chatMatch && req.method === "POST") {
      return handleChatRequest(req, env, chatMatch[1], corsHeaders);
    }

    return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  },
};

async function handleChatRequest(
  req: Request,
  env: Env,
  consultantId: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  // 1. Auth
  const token = extractBearer(req);
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }
  const jwt = await validateJWT(env, token);
  if (!jwt?.sub) {
    return Response.json({ error: "Invalid token" }, { status: 401, headers: corsHeaders });
  }
  const userId = jwt.sub;

  // 2. Parse body
  let body: { conversationId?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders });
  }

  const { conversationId, content } = body;
  if (!conversationId || !content) {
    return Response.json({ error: "conversationId and content required" }, { status: 400, headers: corsHeaders });
  }
  if (content.length > 4000) {
    return Response.json({ error: "Message too long (max 4000 chars)" }, { status: 400, headers: corsHeaders });
  }

  // 3. Concurrency
  const acquire = tryAcquire(userId);
  if (!acquire.allowed) {
    return Response.json({ error: acquire.error ?? "Too many concurrent chats" }, { status: 429, headers: corsHeaders });
  }

  try {
    // 4. Load persona from D1
    const persona = await loadPersona(env, consultantId);
    if (!persona) {
      return Response.json({ error: "Consultant not found" }, { status: 404, headers: corsHeaders });
    }

    // 5. Billing (free consultants skip billing)
    if (persona.isPaid) {
      const billing = await startChatBilling(env, userId, consultantId, conversationId);
      if (!billing.success) {
        return Response.json(
          { error: billing.error ?? "Billing failed" },
          { status: billing.code === "INSUFFICIENT_BALANCE" ? 402 : 400, headers: corsHeaders },
        );
      }
    }

    // 6. Build callAI function bound to env
    const callAIFn = async (opts: { messages: AIMessage[]; stream?: boolean; temperature?: number; maxTokens?: number }): Promise<CallAIResult> => {
      const result = await callAI(env, {
        messages: opts.messages,
        stream: opts.stream,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      });
      return { response: result.response, provider: result.provider, attempts: result.attempts };
    };

    // 7. Handle chat (SSE stream)
    const { stream } = await handleAIChat({
      env,
      conversationId,
      consultantId,
      userId,
      content,
      persona,
      callAI: callAIFn,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
        ...corsHeaders,
      },
    });
  } catch (err) {
    console.error("[chat-worker] error:", err instanceof Error ? err.message : err);
    return Response.json(
      { error: "AI chat is momentarily unavailable — please try again." },
      { status: 500, headers: corsHeaders },
    );
  } finally {
    // Release concurrency after stream completes
    // Note: in Workers, the response is returned immediately and the stream
    // continues in the background. We release after a reasonable timeout.
    setTimeout(() => release(userId), 60_000);
  }
}
