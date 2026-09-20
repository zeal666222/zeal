import {NextResponse} from "next/server";
import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import {ensureUserRow, ensureConsultantRow, syncAppMetadata} from "@zeal/database/server";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["SUPPORT","ADMIN","SUPER_ADMIN","VIEWER"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") ?? "magiclink";
  const loginUrl = new URL("/login", req.url);

  if (!tokenHash) {
    loginUrl.searchParams.set("error", "missing_token");
    return NextResponse.redirect(loginUrl);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* RSC */ }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "magiclink",
  });

  if (error || !data.user) {
    console.warn("[handoff] verifyOtp failed:", error?.message);
    loginUrl.searchParams.set("error", "handoff_failed");
    return NextResponse.redirect(loginUrl);
  }

  // Self-heal provisioning
  const { role } = await ensureUserRow(data.user);
  await syncAppMetadata(data.user.id, role, data.user.app_metadata);

  if (role === "CLIENT_ADMIN") {
    try { await ensureConsultantRow(data.user, { category: "ASTROLOGER", rate: 50 }); }
    catch (err) { console.warn("[handoff] consultant provisioning:", err); }
    return NextResponse.redirect(new URL("/consultant/dashboard", req.url));
  }
  if (ADMIN_ROLES.includes(role)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Not authorized for admin portal → clear session + bounce
  await supabase.auth.signOut();
  loginUrl.searchParams.set("error", "not_authorized");
  return NextResponse.redirect(loginUrl);
}
