"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

async function getAdminSupabase() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  // Strict Authorization Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!["admin", "superadmin", "super_admin"].includes(profile?.role || "")) {
    throw new Error("Privilege Escalation Blocked");
  }

  return supabase;
}

export async function processApplicationAction(applicationId: string, applicantId: string, action: 'approve' | 'reject') {
  try {
    const supabase = await getAdminSupabase();

    if (action === 'approve') {
      // Trigger the Atomic RPC we built in PostgreSQL
      const { error } = await supabase.rpc("approve_consultant", {
        target_application_id: applicationId,
        target_user_id: applicantId
      });
      if (error) return { success: false, error: error.message };
    } else {
      // Reject application
      const { error } = await supabase
        .from("consultant_applications")
        .update({ status: "rejected" })
        .eq("id", applicationId);
      if (error) return { success: false, error: error.message };
    }

    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
