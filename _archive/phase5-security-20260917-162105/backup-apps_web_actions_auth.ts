"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { syncAuthUser } from "@/lib/auth/server";

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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (err) {
            console.error("[COOKIE_SET_ERROR]", err);
          }
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
  try {
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const password = formData.get("password") as string;
    const customRedirect = formData.get("redirectTo") as string | null;

    if (!email || !password) {
      return { success: false, error: "Email and password are required." };
    }

    const supabase = await getSupabase();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email, password,
    });

    if (authError || !authData.user) {
      return { success: false, error: authError?.message || "Invalid credentials." };
    }

    const sync = await syncAuthUser();
    if (!sync.ok) {
      return { success: false, error: sync.error ?? "Session sync failed." };
    }

    const safeCustom =
      customRedirect &&
      customRedirect !== "/" &&
      customRedirect !== "/login" &&
      customRedirect !== "/auth/login";

    const destination =
      sync.role === "USER" && safeCustom ? customRedirect! : sync.redirectTo;

    return { success: true, destination };
  } catch (error: any) {
    console.error("[LOGIN_ACTION_ERROR]", error);
    return { success: false, error: "An unexpected error occurred during login." };
  }
}

export async function registerAction(formData: FormData): Promise<{
  success: boolean;
  destination?: string;
  error?: string;
}> {
  try {
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const password = formData.get("password") as string;
    const fullName = (formData.get("fullName") as string)?.trim();
    const accountType = (formData.get("accountType") as string) || "user";

    if (!email || !password || !fullName) {
      return { success: false, error: "All fields are required." };
    }
    if (password.length < 12) {
      return { success: false, error: "Password must be at least 12 characters." };
    }

    const supabase = await getSupabase();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } },
    });

    if (authError || !authData.user) {
      return { success: false, error: authError?.message || "Registration failed." };
    }

    const sync = await syncAuthUser();
    const destination =
      accountType === "consultant" ? "/apply" : sync.redirectTo || "/explore";

    return { success: true, destination };
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
