// apps/web/app/api/auth/sync-user/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Sync Supabase auth user → public User table + create Wallet
//
// SECURITY FIX (Phase 4):
//   The previous version trusted `user_metadata.role`, allowing a client to
//   set `role: "SUPER_ADMIN"` during signup. This version ALWAYS writes
//   `role: "USER"`. Role promotion is now server-side only (via admin RPC).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createServerClientFromCookies, createAdminClient } from "@zeal/database/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createServerClientFromCookies();
    const { data: { user }, error: sessionError } = await supabase.auth.getUser();

    if (sessionError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // ─── 1. Upsert User (role ALWAYS USER on creation) ─────────────────────
    const email = user.email ?? "";
    const username =
      (user.user_metadata?.username as string | undefined) ||
      email.split("@")[0] ||
      `user_${user.id.slice(0, 8)}`;

    const name =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      null;

    const avatar = (user.user_metadata?.avatar_url as string | undefined) ?? null;

    const { data: existing } = await admin
      .from("User")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    let userData: unknown = null;
    let isNew = false;

    if (!existing) {
      // New user — always USER role
      isNew = true;
      const { data, error } = await admin
        .from("User")
        .insert({
          id: user.id,
          email,
          username,
          name,
          avatar,
          role: "USER", // ← HARD-CODED. Never trust user_metadata.
          sparks: 0,
          isVerified: false,
        })
        .select("id, email, username, name, avatar, role")
        .single();

      if (error) throw new Error(`User insert failed: ${error.message}`);
      userData = data;
    } else {
      // Existing user — update only safe fields (never role)
      const { data, error } = await admin
        .from("User")
        .update({
          email: email || undefined,
          name: name ?? undefined,
          avatar: avatar ?? undefined,
        })
        .eq("id", user.id)
        .select("id, email, username, name, avatar, role")
        .single();

      if (error) throw new Error(`User update failed: ${error.message}`);
      userData = data;
    }

    // ─── 2. Ensure wallet exists ───────────────────────────────────────────
    const { data: walletExisting } = await admin
      .from("Wallet")
      .select("id, balance")
      .eq("userId", user.id)
      .maybeSingle();

    let walletData: unknown = walletExisting;

    if (!walletExisting) {
      const { data: newWallet, error: walletError } = await admin
        .from("Wallet")
        .insert({
          id: crypto.randomUUID(),
          userId: user.id,
          balance: 0,
          escrow: 0,
          pendingIn: 0,
          pendingOut: 0,
          blocked: 0,
        })
        .select("id, balance")
        .single();

      if (walletError) {
        console.warn("[sync-user] Wallet creation failed:", walletError.message);
      } else {
        walletData = newWallet;
      }
    }

    // ─── 3. Return ─────────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      user: userData,
      wallet: walletData,
      isNew,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    console.error("[sync-user] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}