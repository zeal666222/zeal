"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
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

export async function completeOnboardingAction(formData: FormData) {
  const dob = formData.get("dob") as string;
  const gender = formData.get("gender") as string;
  const zodiac = formData.get("zodiac") as string;

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  // 1. Update Profile in Supabase (Real Database Write)
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      date_of_birth: dob || null,
      gender: gender || null,
      zodiac_sign: zodiac || null,
      onboarding_completed: true
    })
    .eq("id", user.id);

  if (profileError) return { success: false, error: profileError.message };

  // 2. Ensure Welcome Bonus Ledger Entry Exists
  // The trigger already gave them 500 in `wallet_balance`, but we need a ledger history record.
  const { data: existingTx } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", user.id)
    .eq("description", "Welcome Bonus")
    .single();

  if (!existingTx) {
    await supabase.from("transactions").insert({
      user_id: user.id,
      amount: 500.00,
      transaction_type: "credit",
      description: "Welcome Bonus",
      status: "completed"
    });
  }

  return { success: true };
}
