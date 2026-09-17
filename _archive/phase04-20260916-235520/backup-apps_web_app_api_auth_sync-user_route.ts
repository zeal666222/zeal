import { NextResponse } from "next/server";
import { createClient } from "@zeal/database";
import { enforceRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    // 1. Enterprise Rate Limiting
    const rateLimit = await enforceRateLimit(req);
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Rate limit exceeded. Please try again." }, { status: 429 });
    }

    // 2. Validate Session
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user } = session;

    // 3. Sync User to Public Table (Upsert with type safety bypass for strict inference)
    const { data: userData, error: userError } = await supabase
      .from("User")
      .upsert({
        id: user.id,
        email: user.email!,
        username: user.user_metadata?.username || user.email!.split("@")[0],
        name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatar: user.user_metadata?.avatar_url || null,
        role: user.user_metadata?.role || "USER",
        updatedAt: new Date().toISOString()
      } as any, { onConflict: "id" })
      .select("id, email, username, name, avatar, role")
      .single();

    if (userError) {
      throw new Error(`Failed to sync user profile: ${userError.message}`);
    }

    // 4. Ensure Wallet Exists
    let { data: walletData } = await supabase
      .from("Wallet")
      .select("id, balance")
      .eq("userId", user.id)
      .maybeSingle();

    if (!walletData) {
      const { data: newWallet, error: walletError } = await supabase
        .from("Wallet")
        .insert({
          id: crypto.randomUUID(),
          userId: user.id,
          balance: 0,
          escrow: 0,
          pendingIn: 0,
          pendingOut: 0,
          blocked: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as any)
        .select("id, balance")
        .single();

      if (walletError) {
        throw new Error(`Failed to create wallet: ${walletError.message}`);
      }
      walletData = newWallet;
    }

    // 5. Return strict NextResponse
    return NextResponse.json({
      success: true,
      user: userData,
      wallet: walletData,
      redirectTo: "/dashboard"
    });

  } catch (error: any) {
    console.error("Sync User Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
