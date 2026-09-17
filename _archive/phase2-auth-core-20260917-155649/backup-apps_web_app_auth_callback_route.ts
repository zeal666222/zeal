import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin: requestOrigin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/explore";
  const intent = searchParams.get("intent") ?? "user";

  const origin = process.env.NEXT_PUBLIC_SITE_URL 
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '') 
    : requestOrigin;

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      const role = profile?.role || "user";

      if (intent === "consultant" && role !== "consultant") return NextResponse.redirect(`${origin}/apply`);

      if (["admin", "superadmin", "super_admin"].includes(role)) return NextResponse.redirect(`${origin}/admin/dashboard`);
      else if (role === "consultant") return NextResponse.redirect(`${origin}/consultant/dashboard`);
      else return NextResponse.redirect(`${origin}${next !== "/" && next !== "/login" && next !== "/auth/login" ? next : "/explore"}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=OAuthFailed`);
}
