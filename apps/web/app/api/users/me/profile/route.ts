// apps/web/app/api/users/me/profile/route.ts
// GET  → self profile + wallet
// GET  ?action=check-username&q=... → username availability
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // ─── Username availability check ─────────────────────────────────────────
  if (action === "check-username") {
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    if (!q) {
      return NextResponse.json({ available: false, reserved: false, reason: "empty" });
    }
    if (q.length < 3 || q.length > 30) {
      return NextResponse.json({
        available: false,
        reserved: false,
        reason: "length",
        message: "Username must be 3–30 characters",
      });
    }
    if (!/^[a-z0-9_]+$/.test(q)) {
      return NextResponse.json({
        available: false,
        reserved: false,
        reason: "format",
        message: "Only letters, numbers, and underscores",
      });
    }

    const { data, error } = await supabase.rpc("check_username_available", {
      p_username: q,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const result = data as { available?: boolean; reserved?: boolean } | null;
    return NextResponse.json({
      available: result?.available ?? false,
      reserved: result?.reserved ?? false,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  // ─── Self profile ────────────────────────────────────────────────────────
  const [profileRes, walletRes, canPostRes] = await Promise.all([
    supabase
      .from("User")
      .select(
        "id, email, username, name, avatar, bio, website, location, role, sparks, is_online, isVerified, post_count, createdAt",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("Wallet")
      .select("id, balance, escrow, pendingIn, pendingOut, blocked")
      .eq("userId", user.id)
      .maybeSingle(),
    supabase.rpc("can_create_post"),
  ]);

  const me = profileRes.data as
    | { id: string; email?: string | null; role?: string | null; post_count?: number | null }
    | null;
  const fallbackLimit = me?.role === "CLIENT_ADMIN" ? 6 : 3;
  const fallbackCurrent = me?.post_count ?? 0;
  const canPostFallback = {
    canPost: fallbackCurrent < fallbackLimit,
    limit: fallbackLimit,
    current: fallbackCurrent,
    remaining: Math.max(0, fallbackLimit - fallbackCurrent),
  };

  return NextResponse.json({
    user: me ?? { id: user.id, email: user.email },
    wallet: walletRes.data ?? { balance: 0, escrow: 0, pendingIn: 0, pendingOut: 0, blocked: 0 },
    canPost: canPostRes.data ?? canPostFallback,
  }, { headers: { "Cache-Control": "no-store" } });
}
