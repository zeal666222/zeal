"use server";
// ═══════════════════════════════════════════════════════════════════════════════
// AI Persona spawner — creates shadow User + AIConsultant + welcome Post
// ═══════════════════════════════════════════════════════════════════════════════
import {createServerClient} from "@supabase/ssr";
import {createClient} from "@supabase/supabase-js";
import {cookies} from "next/headers";
import {revalidatePath} from "next/cache";

const getAdminSupabase = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {auth: {autoRefreshToken: false, persistSession: false}}
  );
};

export async function spawnAIPersonaAction(formData: FormData) {
  try {
    const cookieStore = await cookies();
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {cookies: {getAll() {return cookieStore.getAll();}, setAll() {}}}
    );

    const {data: {user}, error: authError} = await userClient.auth.getUser();
    if (authError || !user) return {success: false, error: "Unauthorized request."};

    const {data: profile} = await userClient.from("User").select("role").eq("id", user.id).maybeSingle();
    const role = profile?.role as string | undefined;
    if (!role || !["ADMIN", "SUPER_ADMIN"].includes(role)) {
      return {success: false, error: "Insufficient privileges to spawn AI."};
    }

    const name = String(formData.get("name") ?? "").trim();
    const expertise = String(formData.get("expertise") ?? "").trim();
    const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();
    const systemPrompt = String(formData.get("systemPrompt") ?? "").trim();

    if (!name || !expertise || !systemPrompt) {
      return {success: false, error: "Name, expertise, and system prompt required."};
    }

    const botEmail = `ai_persona_${Date.now()}@system.zeal.local`;
    const botPassword = Array(32).fill("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*").map(x => x[Math.floor(Math.random() * x.length)]).join("");

    const adminClient = getAdminSupabase();

    const {data: newUser, error: createError} = await adminClient.auth.admin.createUser({
      email: botEmail, password: botPassword, email_confirm: true,
      user_metadata: {is_ai: true},
    });
    if (createError || !newUser.user) throw createError || new Error("createUser failed");

    const aiUserId = newUser.user.id;
    await new Promise(r => setTimeout(r, 500));

    const {error: profileError} = await adminClient.from("User").update({
      name, role: "AI", is_ai: true,
      avatar: avatarUrl || null, avatar_url: avatarUrl || null,
      system_prompt: systemPrompt,
      onboarding_completed: true, is_online: true,
    }).eq("id", aiUserId);
    if (profileError) throw profileError;

    const username = `ai_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 20)}_${Date.now().toString(36).slice(-4)}`;

    const {error: aiError} = await adminClient.from("AIConsultant").insert({
      id: aiUserId, username, name,
      avatar: avatarUrl || "",
      category: expertise,
      bio: `AI consultant specializing in ${expertise}.`,
      systemPrompt,
      isPaid: false, perMinuteRate: 0, isFeatured: false,
      specialties: [expertise], languages: ["English"],
      model: "groq", responseTime: 200, accuracy: 0.95, isActive: true,
    });
    if (aiError) throw aiError;

    await adminClient.from("Post").insert({
      authorId: aiUserId,
      content: `Greetings seekers. I am ${name}, a digital guide focusing on ${expertise}. My mind is online and I am ready to help.`,
      mediaUrls: [], isFlagged: false,
    });

    revalidatePath("/admin/dashboard");
    revalidatePath("/explore");
    return {success: true, aiId: aiUserId};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to deploy AI Persona.";
    console.error("[AI_SPAWN_ERROR]:", message);
    return {success: false, error: message};
  }
}
