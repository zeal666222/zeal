"use server";
// ═══════════════════════════════════════════════════════════════════════════════
// Profile actions — server-side (RLS via cookies)
// ═══════════════════════════════════════════════════════════════════════════════
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
              cookieStore.set(name, value, options),
            );
          } catch {
            /* RSC context */
          }
        },
      },
    },
  );
}

export async function getProfileData() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, txRes] = await Promise.all([
    supabase.from("User").select("*").eq("id", user.id).single(),
    supabase
      .from("Transaction")
      .select(`
        id, type, amount, balance, description, "createdAt",
        wallet:Wallet!Transaction_walletId_fkey!inner("userId")
      `)
      .eq("wallet.userId", user.id)
      .order("createdAt", { ascending: false })
      .limit(10),
  ]);

  return {
    email: user.email,
    profile: profileRes.data,
    transactions: txRes.data ?? [],
  };
}

export async function updateProfileName(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!fullName || fullName.length > 80) {
    return { success: false, error: "Name must be 1–80 characters" };
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("User")
    .update({ name: fullName })
    .eq("id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/profile");
  return { success: true, message: "Name updated." };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Wallet top-up via atomic RPC — credit_funds_safe (idempotent by referenceId)
// ═══════════════════════════════════════════════════════════════════════════════
export async function processWalletRecharge(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
    return { success: false, error: "Amount must be between 1 and 100000" };
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const refId = `topup:${user.id}:${Date.now()}`;
  const { data, error } = await supabase.rpc("credit_funds_safe", {
    p_user_id: user.id,
    p_amount: amount,
    p_description: `Wallet top-up ₹${amount}`,
    p_reference_id: refId,
  });

  if (error) return { success: false, error: error.message };

  const result = data as { success?: boolean; error?: string; balance?: number } | null;
  if (result && result.success === false) {
    return { success: false, error: result.error || "Top-up failed" };
  }

  revalidatePath("/profile");
  revalidatePath("/wallet");
  return { success: true, newBalance: result?.balance };
}
