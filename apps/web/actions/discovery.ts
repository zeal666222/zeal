"use server";
// ═══════════════════════════════════════════════════════════════════════════════
// Discovery — explore feed + consultant details + session request
// ═══════════════════════════════════════════════════════════════════════════════
import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cs) { try { cs.forEach(({name, value, options}) => cookieStore.set(name, value, options)); } catch {} },
      },
    }
  );
}

export async function getExploreFeed() {
  const supabase = await getSupabase();

  const {data: consultants, error: consultantError} = await supabase
    .from("User")
    .select("id, name, avatar, cover_url, role, is_online")
    .eq("role", "CLIENT_ADMIN")
    .limit(20);

  const {data: posts, error: postError} = await supabase
    .from("Post")
    .select('id, content, "mediaUrls", "createdAt", "authorId", author:User!authorId(name, avatar)')
    .eq("isFlagged", false)
    .order("createdAt", {ascending: false})
    .limit(20);

  return {
    consultants: consultants || [],
    posts: posts || [],
    error: consultantError?.message || postError?.message || null,
  };
}

export async function getConsultantDetails(consultantId: string) {
  const supabase = await getSupabase();

  const {data: profile, error} = await supabase.from("User").select("*").eq("id", consultantId).maybeSingle();
  const {data: posts} = await supabase.from("Post").select("*")
    .eq("authorId", consultantId).eq("isFlagged", false)
    .order("createdAt", {ascending: false});

  return {profile: profile || null, posts: posts || [], error: error?.message || null};
}

export async function requestConsultationSession(consultantId: string) {
  try {
    const supabase = await getSupabase();
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return {success: false, error: "Authentication required."};
    if (user.id === consultantId) return {success: false, error: "Cannot consult yourself."};

    const {data: conversationId, error} = await supabase.rpc("get_or_create_conversation", {
      p_user_a: user.id, p_user_b: consultantId,
    });
    if (error) return {success: false, error: error.message};
    return {success: true, sessionId: conversationId};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to initiate session.";
    return {success: false, error: message};
  }
}
