"use server";
// ═══════════════════════════════════════════════════════════════════════════════
// Chat — send message + AI inference trigger
// ═══════════════════════════════════════════════════════════════════════════════
import {createServerClient} from "@supabase/ssr";
import {createClient} from "@supabase/supabase-js";
import {cookies} from "next/headers";

async function getUserSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {cookies: {getAll() { return cookieStore.getAll(); }, setAll() {}}},
  );
}

const getAdminSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {auth: {persistSession: false}},
);

export async function sendMessageAction(conversationId: string, content: string) {
  const supabase = await getUserSupabase();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) return {success: false, error: "Unauthorized"};

  const {error} = await supabase.from("Message").insert({
    conversationId, senderId: user.id, content, type: "text",
  });
  if (error) return {success: false, error: error.message};

  if (!content.startsWith("[WEBRTC_")) {
    const {data: partners} = await supabase
      .from("ConversationParticipant")
      .select("userId")
      .eq("conversationId", conversationId)
      .neq("userId", user.id);

    const partnerId = partners?.[0]?.userId;
    if (partnerId) {
      const {data: partnerUser} = await supabase.from("User").select("role").eq("id", partnerId).maybeSingle();
      if (partnerUser?.role === "AI") {
        void triggerAIInference(conversationId, partnerId, content);
      }
    }
  }

  return {success: true};
}

async function triggerAIInference(conversationId: string, aiUserId: string, userMessage: string) {
  try {
    const admin = getAdminSupabase();
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));

    const {data: ai} = await admin
      .from("AIConsultant")
      .select("systemPrompt, category, specialties")
      .eq("id", aiUserId)
      .maybeSingle();

    const specialties = ai?.specialties ?? [];
    let response = "I sense a strong energy shift. Tell me more about what you are feeling.";
    if (specialties.some(s => /vedic/i.test(s))) {
      response = "The planetary alignments indicate a period of transition. What guidance do you seek?";
    } else if (specialties.some(s => /tarot/i.test(s))) {
      response = "I have pulled the High Priestess. Trust your intuition. What feels blocked?";
    }

    await admin.from("Message").insert({
      conversationId, senderId: aiUserId, content: response, type: "text",
    });
  } catch (error) {
    console.error("AI Inference Failed:", error);
  }
}
