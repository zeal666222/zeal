// apps/web/app/api/auth/sync-user/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Sync Supabase auth user → public User table + Wallet
// Delegates to syncAuthUser() — the single source of truth for auth sync.
//
// SECURITY NOTE:
//   Role is ALWAYS written as "USER" on creation. Never trusts user_metadata.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { syncAuthUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await syncAuthUser();

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Sync failed" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    role: result.role,
    isNew: result.isNew,
    redirectTo: result.redirectTo,
  });
}
