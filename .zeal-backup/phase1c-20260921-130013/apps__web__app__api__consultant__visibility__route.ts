// ZEAL_FIX_CONSULTANT_VISIBILITY_API
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createServerClientFromCookies();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "not_authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase.rpc("consultant_visibility_report");
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json(data ?? { success: false, error: "empty" });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
