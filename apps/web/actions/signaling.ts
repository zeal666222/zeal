"use server";
// ═══════════════════════════════════════════════════════════════════════════════
// Session signaling — initiate + respond via Conversation
// ═══════════════════════════════════════════════════════════════════════════════
import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {cookies: {getAll() { return cookieStore.getAll(); }, setAll() {}}},
  );
}

export async function initiateSessionAction(consultantId: string) {
  const supabase = await getSupabase();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) return {success: false, error: "Unauthorized"};

  const {data: partner} = await supabase
    .from("User")
    .select("is_ai, is_online")
    .eq("id", consultantId)
    .maybeSingle();

  if (!partner?.is_online) {
    return {success: false, error: "Consultant is currently offline."};
  }

  const {data: conversationId, error} = await supabase.rpc("get_or_create_conversation", {
    p_user_a: user.id, p_user_b: consultantId,
  });
  if (error || !conversationId) return {success: false, error: "Failed to signal consultant."};

  return {success: true, sessionId: conversationId, status: partner.is_ai ? "active" : "ringing"};
}

export async function respondToSessionAction(conversationId: string, status: "active" | "declined") {
  const supabase = await getSupabase();
  const {error} = await supabase
    .from("Conversation")
    .update({metadata: {status}})
    .eq("id", conversationId);
  if (error) return {success: false, error: error.message};
  return {success: true};
}
