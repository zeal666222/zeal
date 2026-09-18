"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureUserRow, resolveDestination, syncAppMetadata, type AppRole } from "@zeal/database/server";

const ALLOWED_ADMIN_ROLES: AppRole[] = ["SUPER_ADMIN", "ADMIN", "SUPPORT", "VIEWER", "CLIENT_ADMIN"];

// ─── Supabase clients ─────────────────────────────────────────────────────────
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
          } catch { /* RSC — safe */ }
        },
      },
    }
  );
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]?.trim() || "unknown";
    return h.get("x-real-ip") || "unknown";
  } catch { return "unknown"; }
}

async function writeAudit(params: {
  category: string;
  action: string;
  outcome: "SUCCESS" | "FAILURE" | "DENIED";
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const admin = getAdminSupabase();
  if (!admin) return;
  try {
    const ipForDb =
      params.ip && params.ip !== "unknown" && params.ip.length > 0
        ? params.ip
        : null;
    // Matches migration 021 schema: action_name is the real event, action is legacy enum.
    await admin.from("AdminAuditLog").insert({
      action: "UPDATE",
      action_name: params.action,
      actor_id: params.actorId ?? null,
      userId: params.actorId ?? null,
      actor_email: params.actorEmail ?? null,
      email: params.actorEmail ?? null,
      actor_role: params.actorRole ?? null,
      target_type: params.category,
      targetType: params.category,
      target_id: null,
      targetId: null,
      ip: ipForDb,
      metadata: params.metadata ?? null,
      success: params.outcome === "SUCCESS",
    } as never);
  } catch (err) {
    console.warn("[admin-audit] write failed:", err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
export async function adminLoginAction(formData: FormData) {
  const ip = await getClientIp();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, error: "Credentials required." };
  }

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      await writeAudit({
        category: "AUTHENTICATION",
        action: "admin_login",
        outcome: "FAILURE",
        actorEmail: email,
        ip,
        metadata: { portal: "admin", reason: error?.message || "invalid_credentials" },
      });
      return { success: false, error: "Invalid credentials." };
    }

    const { role } = await ensureUserRow(data.user);
    await syncAppMetadata(data.user.id, role, data.user.app_metadata);

    const { data: consultant } = await supabase
      .from("Consultant")
      .select("id")
      .eq("userId", data.user.id)
      .maybeSingle();

    const hasConsultant = Boolean(consultant?.id);
    const effectiveRole: AppRole = hasConsultant ? "CLIENT_ADMIN" : role;

    if (!ALLOWED_ADMIN_ROLES.includes(effectiveRole)) {
      await supabase.auth.signOut();
      await writeAudit({
        category: "AUTHORIZATION",
        action: "admin_login_denied",
        outcome: "DENIED",
        actorId: data.user.id,
        actorEmail: email,
        actorRole: effectiveRole,
        ip,
        metadata: { portal: "admin", reason: "role_not_allowed" },
      });
      return { success: false, error: "This account does not have access to the admin portal." };
    }

    await writeAudit({
      category: "AUTHENTICATION",
      action: "admin_login",
      outcome: "SUCCESS",
      actorId: data.user.id,
      actorEmail: email,
      actorRole: effectiveRole,
      ip,
      metadata: { portal: "admin" },
    });

    const destination = resolveDestination({
      role: effectiveRole,
      hasConsultant,
      portal: "admin",
    });

    return { success: true, destination };
  } catch (err) {
    const message = err instanceof Error ? err.message : "login failed";
    await writeAudit({
      category: "AUTHENTICATION",
      action: "admin_login",
      outcome: "FAILURE",
      actorEmail: email,
      ip,
      metadata: { portal: "admin", error: message },
    });
    return { success: false, error: "Authentication failed." };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN SIGN OUT
// ═══════════════════════════════════════════════════════════════════════════════
export async function adminSignOutAction() {
  const ip = await getClientIp();
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.auth.signOut();

    await writeAudit({
      category: "AUTHENTICATION",
      action: "admin_logout",
      outcome: "SUCCESS",
      actorId: user?.id ?? null,
      actorEmail: user?.email ?? null,
      ip,
      metadata: { portal: "admin" },
    });
  } catch (err) {
    console.warn("[adminSignOut] audit failed:", err);
  }
  redirect("/login");
}
