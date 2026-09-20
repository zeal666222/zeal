import {createClient} from "@zeal/database/server";
import {redirect} from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AuthSortingHat() {
  const supabase = await createClient();
  const {data: {user}, error} = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const {data: profile} = await supabase
    .from("User")
    .select("role, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as string) || "USER";
  const isOnboarded = Boolean(profile?.onboarding_completed);

  if (role === "ADMIN" || role === "SUPER_ADMIN") redirect("/dashboard");
  if (role === "CLIENT_ADMIN") {
    if (!isOnboarded) redirect("/consultant/onboarding");
    redirect("/consultant/dashboard");
  }
  redirect("/");
}
