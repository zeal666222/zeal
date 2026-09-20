"use server";
// ═══════════════════════════════════════════════════════════════════════════════
// Admin actions — canonical tables only
// ═══════════════════════════════════════════════════════════════════════════════
import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cs) {
          try { cs.forEach(({name, value, options}) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
}

export async function getAdminMetrics() {
  try {
    const supabase = await getSupabase();
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return {userCount: 0, pendingAppsCount: 0, applications: [], auditLogs: [], error: "Unauthorized"};

    const {data: profile} = await supabase.from("User").select("role").eq("id", user.id).maybeSingle();
    const role = profile?.role as string | undefined;
    if (!role || !["ADMIN", "SUPER_ADMIN", "SUPPORT"].includes(role)) {
      return {userCount: 0, pendingAppsCount: 0, applications: [], auditLogs: [], error: "Forbidden access"};
    }

    const [usersRes, pendingRes, appsRes, auditRes] = await Promise.all([
      supabase.from("User").select("*", {count: "exact", head: true}),
      supabase.from("Consultant").select("*", {count: "exact", head: true}).eq("status", "PENDING"),
      supabase.from("Consultant")
        .select(`id, category, status, bio, "createdAt", user:User!Consultant_userId_fkey(id, name, email, avatar)`)
        .order("createdAt", {ascending: false}).limit(100),
      supabase.from("AdminAuditLog").select("*").order("createdAt", {ascending: false}).limit(20),
    ]);

    return {
      userCount: usersRes.count ?? 0,
      pendingAppsCount: pendingRes.count ?? 0,
      applications: appsRes.data ?? [],
      auditLogs: auditRes.data ?? [],
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load metrics.";
    return {userCount: 0, pendingAppsCount: 0, applications: [], auditLogs: [], error: message};
  }
}

export async function processApplicationAction(consultantId: string, userId: string, approve: boolean) {
  return reviewConsultantApplication(consultantId, userId, approve);
}

export async function reviewConsultantApplication(consultantId: string, userId: string, approve: boolean) {
  try {
    const supabase = await getSupabase();
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return {success: false, error: "Unauthorized"};

    const newStatus = approve ? "VERIFIED" : "REJECTED";

    const {error: appError} = await supabase
      .from("Consultant")
      .update({status: newStatus, isActive: approve, isVerified: approve})
      .eq("id", consultantId);
    if (appError) return {success: false, error: appError.message};

    if (approve && userId) {
      const {error: userError} = await supabase.from("User").update({role: "CLIENT_ADMIN"}).eq("id", userId);
      if (userError) return {success: false, error: userError.message};
    }

    return {success: true};
  } catch (err) {
    const message = err instanceof Error ? err.message : "Review action failed.";
    return {success: false, error: message};
  }
}
