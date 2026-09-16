"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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

export async function loginAction(formData: FormData): Promise<{
  success: boolean;
  destination?: string;
  error?: string;
}> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const customRedirect = formData.get("redirectTo") as string | null;

  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  const supabase = await getSupabase();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    return { success: false, error: authError?.message || "Invalid credentials." };
  }

  // Role verification from database
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  const role = profile?.role || "user";
  let destination = "/explore";

  if (["admin", "superadmin", "super_admin"].includes(role)) {
    destination = "/admin/dashboard";
  } else if (role === "consultant") {
    destination = "/consultant/dashboard";
  } else {
    destination =
      customRedirect && customRedirect !== "/" && customRedirect !== "/login"
        ? customRedirect
        : "/explore";
  }

  return { success: true, destination };
}

export async function registerAction(formData: FormData): Promise<{
  success: boolean;
  destination?: string;
  error?: string;
}> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const fullName = (formData.get("fullName") as string)?.trim();
  const accountType = (formData.get("accountType") as string) || "user";

  if (!email || !password || !fullName) {
    return { success: false, error: "All fields are required." };
  }

  const supabase = await getSupabase();
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: "user",
      },
    },
  });

  if (authError || !authData.user) {
    return { success: false, error: authError?.message || "Registration failed." };
  }

  // Ensure public profile exists
  await supabase.from("profiles").upsert(
    {
      id: authData.user.id,
      full_name: fullName,
      role: "user",
    },
    { onConflict: "id" }
  );

  if (accountType === "consultant") {
    return { success: true, destination: "/apply" };
  }

  return { success: true, destination: "/explore" };
}

export async function signOutAction() {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
