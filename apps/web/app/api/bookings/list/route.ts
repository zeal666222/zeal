import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("Booking")
    .select(`
      id, "scheduledAt", "durationMinutes", status, amount,
      consultant:Consultant!Booking_consultantId_fkey(
        user:User!Consultant_userId_fkey(name, username, avatar)
      )
    `)
    .eq("userId", user.id)
    .order("scheduledAt", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookings: data ?? [] });
}
