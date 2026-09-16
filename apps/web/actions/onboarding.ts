"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

// Full Submission Action
export async function completeOnboardingAction(formData: FormData) {
  const dob = formData.get("dob") as string;
  const gender = formData.get("gender") as string;
  const zodiac = formData.get("zodiac") as string;

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

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

  await injectWelcomeBonusLedger(supabase, user.id);
  return { success: true };
}

// New Skip Action for Standard Users
export async function skipOnboardingAction() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);

  if (error) return { success: false, error: error.message };

  await injectWelcomeBonusLedger(supabase, user.id);
  return { success: true };
}

// Helper: Ensure the ledger reflects the welcome bonus
async function injectWelcomeBonusLedger(supabase: any, userId: string) {
  const { data: existingTx } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("description", "Welcome Bonus")
    .single();

  if (!existingTx) {
    await supabase.from("transactions").insert({
      user_id: userId,
      amount: 500.00,
      transaction_type: "credit",
      description: "Welcome Bonus",
      status: "completed"
    });
  }
}
