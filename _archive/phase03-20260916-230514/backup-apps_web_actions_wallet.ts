"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
}

export async function getWalletBalance() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { balance: 0 };

  const { data } = await supabase
    .from("profiles")
    .select("wallet_balance")
    .eq("id", user.id)
    .single();

  return { balance: data?.wallet_balance || 0 };
}

export async function topUpWalletAction(amount: number) {
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized session." };

    if (amount <= 0 || amount > 50000) {
      return { success: false, error: "Invalid top-up amount bounds." };
    }

    // Fetch current balance
    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_balance")
      .eq("id", user.id)
      .single();

    const currentBalance = Number(profile?.wallet_balance || 0);
    const newBalance = currentBalance + amount;

    // Perform atomic update
    const { error } = await supabase
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq("id", user.id);

    if (error) return { success: false, error: error.message };

    return { success: true, newBalance };
  } catch (err: any) {
    return { success: false, error: err.message || "Wallet transaction failed." };
  }
}
