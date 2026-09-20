"use server";
// ═══════════════════════════════════════════════════════════════════════════════
// Consultant studio — online toggle
// ═══════════════════════════════════════════════════════════════════════════════
import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import {revalidatePath} from "next/cache";

async function getConsultantSupabase() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {cookies: {getAll() { return cookieStore.getAll(); }, setAll() {}}},
  );

  const {data: {user}} = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const {data: profile} = await supabase.from("User").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role as string | undefined;
  if (role !== "CLIENT_ADMIN" && !["ADMIN", "SUPER_ADMIN"].includes(role ?? "")) {
    throw new Error("Privilege Escalation Blocked");
  }
  return {supabase, user};
}

export async function toggleOnlineStatus(currentStatus: boolean) {
  try {
    const {supabase, user} = await getConsultantSupabase();
    const {error} = await supabase.from("User").update({is_online: !currentStatus}).eq("id", user.id);
    if (error) return {success: false, error: error.message};

    revalidatePath("/consultant/dashboard");
    revalidatePath("/explore");
    return {success: true, is_online: !currentStatus};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return {success: false, error: message};
  }
}
