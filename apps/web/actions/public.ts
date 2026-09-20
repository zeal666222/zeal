"use server";
// ═══════════════════════════════════════════════════════════════════════════════
// Public API — consultant public profile
// ═══════════════════════════════════════════════════════════════════════════════
import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getPublicSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {cookies: {getAll() { return cookieStore.getAll(); }, setAll() {}}},
  );
}

export async function getConsultantPublicProfile(id: string) {
  try {
    if (!UUID_REGEX.test(id)) return {success: false, error: "Invalid profile identifier."};

    const supabase = await getPublicSupabase();

    const {data: profile, error: profileError} = await supabase
      .from("User")
      .select("id, name, avatar, cover_url, is_ai, is_online, role")
      .eq("id", id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "CLIENT_ADMIN") {
      return {success: false, error: "Consultant not found or inactive."};
    }

    const {data: posts, error: postsError} = await supabase
      .from("Post")
      .select("id, mediaUrls, content, createdAt")
      .eq("authorId", id)
      .eq("isFlagged", false)
      .order("createdAt", {ascending: false});

    if (postsError) throw postsError;

    return {success: true, profile, posts: posts || []};
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    console.error("[PUBLIC_API_ERROR]:", message);
    return {success: false, error: message};
  }
}
