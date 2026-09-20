"use server";

import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import {ensureUserRow, ensureConsultantRow, syncAppMetadata} from "@zeal/database/server";

export type RegisterResult =
  | { ok: true; destination?: string; needsConfirmation?: false }
  | { ok: true; needsConfirmation: true }
  | { ok: false; error: string };

export async function registerConsultantAction(
  formData: FormData,
): Promise<RegisterResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || !password || !fullName) {
    return { ok: false, error: "All fields required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Invalid email." };
  }
  if (password.length < 12) {
    return { ok: false, error: "Password must be 12+ chars." };
  }

  const adminUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, "");
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch { /* RSC context */ }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, account_type: "consultant" },
      emailRedirectTo: `${adminUrl}/auth/callback`,
    },
  });

  if (error) {
    if (/already|exist/i.test(error.message)) {
      return { ok: false, error: "An account with this email already exists." };
    }
    return { ok: false, error: error.message };
  }
  if (!data.user) return { ok: false, error: "Signup failed." };

  // Provision User + Wallet + Consultant (idempotent)
  await ensureUserRow(data.user);
  await ensureConsultantRow(data.user, { category: "ASTROLOGER", rate: 50 });
  await syncAppMetadata(data.user.id, "CLIENT_ADMIN", data.user.app_metadata);

  if (!data.session) return { ok: true, needsConfirmation: true };
  return { ok: true, destination: "/consultant/dashboard" };
}
