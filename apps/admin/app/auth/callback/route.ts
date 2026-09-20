import {NextResponse} from "next/server";
import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import {ensureUserRow, ensureConsultantRow, syncAppMetadata} from "@zeal/database/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch { /* RSC context */ }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const { role } = await ensureUserRow(data.user);

  if (role === "CLIENT_ADMIN" || data.user.user_metadata?.account_type === "consultant") {
    await ensureConsultantRow(data.user, { category: "ASTROLOGER", rate: 50 });
    await syncAppMetadata(data.user.id, "CLIENT_ADMIN", data.user.app_metadata);
    return NextResponse.redirect(`${origin}/consultant/dashboard`);
  }

  if (["SUPPORT", "ADMIN", "SUPER_ADMIN", "VIEWER"].includes(role)) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  const webUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (webUrl) return NextResponse.redirect(`${webUrl}/explore`);
  return NextResponse.redirect(`${origin}/login?error=not_authorized`);
}
