"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
}

export async function submitConsultantApplication(formData: FormData) {
  const expertise = formData.get("expertise") as string;
  const bio = formData.get("bio") as string;
  const avatarUrl = formData.get("avatarUrl") as string;
  const coverUrl = formData.get("coverUrl") as string;
  
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

  const { error } = await supabase
    .from("consultant_applications")
    .insert({
      user_id: user.id,
      full_name: profile?.full_name || "Unknown Applicant",
      expertise,
      bio,
      avatar_url: avatarUrl || null,
      cover_url: coverUrl || null,
      status: "pending"
    });

  if (error) {
    if (error.code === '23505') return { success: false, error: "You already have a pending application." };
    return { success: false, error: error.message };
  }

  revalidatePath("/apply");
  return { success: true };
}

export async function checkApplicationStatus() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: null };

  const { data } = await supabase
    .from("consultant_applications")
    .select("status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return { status: data?.status || null };
}
