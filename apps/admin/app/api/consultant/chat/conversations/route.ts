// apps/admin/app/api/consultant/chat/conversations/route.ts
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { fetchConsultantConversations } from "@/lib/chat/fetch-conversations";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const items = await fetchConsultantConversations(user.id);
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
