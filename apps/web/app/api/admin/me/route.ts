import {NextResponse} from "next/server";
import {requireUserAPI} from "@/lib/auth/api-guard";
import {createAdminClient} from "@zeal/database/server";

export const dynamic = "force-dynamic";

// Returns the caller's staff role, or null for regular users. The profile
// menu polls this so a role granted or revoked in the admin panel shows up
// within seconds instead of waiting for the JWT to refresh.
export async function GET() {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;

  const admin = createAdminClient();
  const {data, error} = await admin
    .from("User")
    .select("role")
    .eq("id", guard.userId!)
    .maybeSingle();

  if (error) return NextResponse.json({error: error.message}, {status: 500});
  const role = (data?.role as string | undefined) ?? null;
  if (!role || role === "USER") return NextResponse.json({role: null});
  return NextResponse.json({role});
}
