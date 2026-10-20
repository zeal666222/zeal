import {createClient} from "@zeal/database/server";
import {redirect} from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AuthSortingHat() {
  const supabase = await createClient();
  const {data: {user}, error} = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const {data: profile} = await supabase
    .from("User")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // Normalise casing so a role stored as "super_admin" still routes correctly
  // (matches adminLoginAction + requireAdminPortal, which both uppercase).
  const role = String(profile?.role ?? "USER").toUpperCase();

  // SUPER_ADMIN / ADMIN / SUPPORT / VIEWER → admin console (never /dashboard
  // again, which previously self-looped).
  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "SUPPORT" || role === "VIEWER") {
    redirect("/admin/dashboard");
  }
  if (role === "CLIENT_ADMIN") {
    redirect("/admin/consultant/dashboard");
  }
  redirect("/");
}
