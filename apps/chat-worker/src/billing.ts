import type { Env } from "./env";
import { rpc } from "./supabase-client";

export interface BillingResult {
  success: boolean;
  sessionId?: string;
  error?: string;
  code?: string;
}

export async function startChatBilling(
  env: Env,
  userId: string,
  consultantId: string,
  conversationId: string,
): Promise<BillingResult> {
  const { data, error } = await rpc<{ success: boolean; session_id?: string; error?: string; code?: string }>(
    env,
    "auto_start_chat_billing",
    { p_user_id: userId, p_consultant_id: consultantId, p_conversation_id: conversationId },
  );

  if (error) return { success: false, error: error.message, code: "RPC_FAIL" };
  if (!data) return { success: false, error: "Billing unavailable", code: "NO_DATA" };
  if (!data.success) return { success: false, error: data.error ?? "Billing declined", code: data.code ?? "DECLINED" };

  return { success: true, sessionId: data.session_id };
}
