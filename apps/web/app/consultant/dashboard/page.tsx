import { createServerClientFromCookies } from "@zeal/database/server";
import { redirect } from "next/navigation";
import { StudioClient } from "@/components/consultant/StudioClient";

export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  name: string | null;
  is_online: boolean | null;
}
interface WalletRow {
  balance: number;
}

export default async function ConsultantDashboardPage() {
  const supabase = await createServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, walletRes] = await Promise.all([
    supabase
      .from("User")
      .select("id, name, is_online")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("Wallet")
      .select("balance")
      .eq("userId", user.id)
      .maybeSingle(),
  ]);

  const u = profileRes.data as UserRow | null;
  const w = walletRes.data as WalletRow | null;

  return (
    <StudioClient
      initialProfile={{
        id: user.id,
        full_name: u?.name ?? "Consultant",
        wallet_balance: w?.balance ?? 0,
        is_online: u?.is_online ?? false,
      }}
    />
  );
}
