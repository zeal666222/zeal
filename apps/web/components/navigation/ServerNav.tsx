import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ClientNav } from "./ClientNav";

export async function ServerNav() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* Handled securely by middleware */ },
      },
    }
  );

  // Securely verify session at the Edge/Server level
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null; // No navigation for logged-out users

  // Fetch the definitive role and onboarding status from PostgreSQL
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", user.id)
    .single();

  // If they are trapped in the onboarding phase, do not show them the navigation
  if (!profile?.onboarding_completed) return null;

  return <ClientNav role={profile?.role || "user"} />;
}
