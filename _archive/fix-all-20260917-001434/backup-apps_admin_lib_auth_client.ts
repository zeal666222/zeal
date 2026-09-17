import { createClient } from "@zeal/database";

export async function getClientSession() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
