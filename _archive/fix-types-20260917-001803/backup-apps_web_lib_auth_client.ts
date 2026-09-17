import { createClient } from "@zeal/database/server";
import { User, Session } from "@supabase/supabase-js";

export async function getClientSession(): Promise<{ user: User | null; session: Session | null }> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Error getting session:", error);
    return { user: null, session: null };
  }
  return { user: data.session?.user ?? null, session: data.session ?? null };
}

export async function signOutClient(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
