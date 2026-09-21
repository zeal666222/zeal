"use server";

// ═══════════════════════════════════════════════════════════════════════════════
// Consultant registration — self-healing, never 500s the page
// ═══════════════════════════════════════════════════════════════════════════════
// Provisioning is best-effort. If Supabase env is missing or the
// provisioning RPCs fail, we still return success so the user reaches
// the confirmation screen; a login-time self-heal repairs the rows.
// ═══════════════════════════════════════════════════════════════════════════════

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  ensureUserRow,
  ensureConsultantRow,
  syncAppMetadata,
} from "@zeal/database/server";

export type RegisterResult =
  | { ok: true; destination?: string; needsConfirmation?: false; warning?: string }
  | { ok: true; needsConfirmation: true; warning?: string }
  | { ok: false; error: string };

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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
    return { ok: false, error: "Password must be 12+ characters." };
  }

  const adminUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, "");
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
            /* RSC context */
          }
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

  // ─── Provisioning — best-effort, never throws ──────────────────────────
  // The DB trigger `on_auth_user_created` (migration 017) already created
  // User + Wallet. These calls are idempotent healers. If they fail here
  // (missing env, cold-start race), the next login runs self_heal_user().
  let warning: string | undefined;

  try {
    await ensureUserRow(data.user, { promoteTo: "CLIENT_ADMIN" });
    await ensureConsultantRow(data.user, {
      category: "ASTROLOGER",
      rate: 50,
    });

    // Belt-and-braces: make the DB row match the JWT claim.
    const admin = adminClient();
    if (admin) {
      await admin
        .from("User")
        .update({ role: "CLIENT_ADMIN" })
        .eq("id", data.user.id);
    }

    const synced = await syncAppMetadata(
      data.user.id,
      "CLIENT_ADMIN",
      data.user.app_metadata,
    );
    if (!synced) {
      warning = "Account created — role will finalise on first sign-in.";
    }
  } catch (err) {
    warning = "Account created — profile will finish provisioning on sign-in.";
    console.error("[registerConsultantAction] provisioning deferred:", err);
  }

  if (!data.session) {
    return { ok: true, needsConfirmation: true, warning };
  }
  return { ok: true, destination: "/consultant/dashboard", warning };
}
