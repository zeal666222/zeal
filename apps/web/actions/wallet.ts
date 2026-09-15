"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

export async function fetchWalletData() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  // Fetch Balance
  const { data: profile } = await supabase
    .from("profiles")
    .select("wallet_balance, full_name")
    .eq("id", user.id)
    .single();

  // Fetch Ledger (Recent 5 transactions)
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return { 
    success: true, 
    balance: profile?.wallet_balance || 0,
    fullName: profile?.full_name || "Zeal Member",
    transactions: transactions || [] 
  };
}

export async function processRechargeAction(amount: number) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  // Securely call the atomic RPC function on the database
  const { data, error } = await supabase.rpc("recharge_wallet", {
    recharge_amount: amount
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/profile"); // Instantly update UI cache
  return { success: true, newBalance: data };
}
