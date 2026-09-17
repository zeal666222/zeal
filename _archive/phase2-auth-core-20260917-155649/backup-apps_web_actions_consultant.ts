"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getSupabase() {
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

export async function checkApplicationStatus() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: null };

  const { data } = await supabase
    .from("consultant_applications")
    .select("status")
    .eq("user_id", user.id)
    .single();

  return { status: data?.status || null };
}

export async function submitConsultantApplication(formData: FormData) {
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized session." };

    const expertise = formData.get("expertise") as string;
    const bio = formData.get("bio") as string;
    const avatarUrl = formData.get("avatarUrl") as string;
    const coverUrl = formData.get("coverUrl") as string;
    const fullName = user.user_metadata?.full_name || "Consultant";

    const { error } = await supabase.from("consultant_applications").upsert(
      {
        user_id: user.id,
        full_name: fullName,
        expertise,
        bio,
        avatarUrl: avatarUrl || null,
        coverUrl: coverUrl || null,
        status: "pending",
      },
      { onConflict: "user_id" }
    );

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Internal server error." };
  }
}
