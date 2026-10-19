"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export type RegisterResult =
  | { ok: true; destination?: string; needsConfirmation?: false; warning?: string }
  | { ok: true; needsConfirmation: true; warning?: string }
  | { ok: false; error: string };

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://zealer.co.in").replace(/\/$/, "");

export async function registerConsultantAction(
  formData: FormData,
): Promise<RegisterResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || !password || !fullName) {
    return { ok: false, error: "All fields are required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (password.length < 12) {
    return { ok: false, error: "Password must be at least 12 characters." };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* RSC */
          }
        },
      },
    },
  );

  // The DB trigger handle_new_user provisions User + Wallet + Consultant.
  // User.role becomes CLIENT_ADMIN automatically.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        account_type: "consultant",
      },
      emailRedirectTo: `${APP_URL}/admin/auth/callback`,
    },
  });

  if (error) {
    if (/already|exist/i.test(error.message)) {
      return { ok: false, error: "An account with this email already exists." };
    }
    return { ok: false, error: error.message };
  }
  if (!data.user) return { ok: false, error: "Signup failed." };

  if (!data.session) {
    return { ok: true, needsConfirmation: true };
  }

  return { ok: true, destination: "/admin/consultant/dashboard" };
}
