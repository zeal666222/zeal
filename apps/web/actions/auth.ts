"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// 1. Standard Client
async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { 
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); 
          } catch (err) {
            console.error("[COOKIE_SET_ERROR]", err);
          }
        },
      },
    }
  );
}

// 2. Admin Client (Used exclusively as an auto-healing fallback)
const getAdminSupabase = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
};

export async function loginAction(formData: FormData): Promise<{ success: boolean; destination?: string; error?: string; }> {
  try {
    const email = (formData.get("email") as string)?.trim();
    const password = formData.get("password") as string;
    const customRedirect = formData.get("redirectTo") as string | null;

    if (!email || !password) return { success: false, error: "Email and password are required." };

    const supabase = await getSupabase();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData.user) return { success: false, error: authError?.message || "Invalid credentials." };

    // AUTO-HEALING: Guarantee profile existence if the SQL trigger failed
    const adminClient = getAdminSupabase();
    const fallbackName = authData.user.user_metadata?.full_name || email.split("@")[0];
    await adminClient.from("profiles").upsert(
      { id: authData.user.id, full_name: fallbackName, role: "user" },
      { onConflict: "id", ignoreDuplicates: true }
    );

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", authData.user.id).single();
    const role = profile?.role || "user";

    let destination = "/explore";
    if (["admin", "superadmin", "super_admin"].includes(role)) destination = "/admin/dashboard";
    else if (role === "consultant") destination = "/consultant/dashboard";
    else destination = (customRedirect && customRedirect !== "/" && customRedirect !== "/login") ? customRedirect : "/explore";

    return { success: true, destination };
  } catch (error: any) {
    console.error("[LOGIN_ACTION_ERROR]", error);
    return { success: false, error: "An unexpected error occurred during login." };
  }
}

export async function registerAction(formData: FormData): Promise<{ success: boolean; destination?: string; error?: string; }> {
  try {
    const email = (formData.get("email") as string)?.trim();
    const password = formData.get("password") as string;
    const fullName = (formData.get("fullName") as string)?.trim();
    const accountType = (formData.get("accountType") as string) || "user";

    if (!email || !password || !fullName) return { success: false, error: "All fields are required." };

    const supabase = await getSupabase();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName, role: "user" } },
    });

    if (authError || !authData.user) return { success: false, error: authError?.message || "Registration failed. Email might be in use." };

    // AUTO-HEALING: Hard-upsert the profile from the server to bypass any trigger failures
    const adminClient = getAdminSupabase();
    await adminClient.from("profiles").upsert(
      { id: authData.user.id, full_name: fullName, role: "user" },
      { onConflict: "id", ignoreDuplicates: true }
    );

    return { success: true, destination: accountType === "consultant" ? "/apply" : "/explore" };
  } catch (error: any) {
    console.error("[REGISTER_ACTION_ERROR]", error);
    return { success: false, error: "An unexpected error occurred during registration." };
  }
}

export async function signOutAction() {
  try {
    const supabase = await getSupabase();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("[SIGNOUT_ERROR]", error);
  }
  redirect("/login");
}
