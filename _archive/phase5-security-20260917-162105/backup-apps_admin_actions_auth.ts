"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ALLOWED_ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "SUPPORT", "VIEWER"];

export async function adminLoginAction(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  if (!email || !password) return { success: false, error: "Credentials required." };

  const cookieStore = await cookies();
  const supabase = createServerClient(
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
          } catch { /* RSC — safe */ }
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { success: false, error: "Invalid credentials." };

  const { data: profile } = await supabase
    .from("User").select("role").eq("id", data.user.id).maybeSingle();

  const role = (profile?.role as string) || "USER";
  if (!ALLOWED_ADMIN_ROLES.includes(role)) {
    await supabase.auth.signOut();
    return { success: false, error: "Unauthorized. Admin access only." };
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    if (data.user.app_metadata?.role !== role) {
      await admin.auth.admin.updateUserById(data.user.id, {
        app_metadata: { ...(data.user.app_metadata ?? {}), role },
      });
    }

    await admin.from("audit_events").insert({
      event_category: "AUTHENTICATION",
      event_action: "admin_login",
      event_outcome: "SUCCESS",
      actor_id: data.user.id,
      actor_email: email,
      actor_role: role,
      metadata: { portal: "admin" },
    });
  } catch (syncErr) {
    console.warn("[adminLoginAction] role sync failed:", syncErr);
  }

  return { success: true, destination: "/" };
}

export async function adminSignOutAction() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
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
          } catch { /* RSC — safe */ }
        },
      },
    }
  );
  await supabase.auth.signOut();
  redirect("/login");
}
