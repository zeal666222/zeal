import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/explore";
  const intent = searchParams.get("intent") ?? "user";

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
      // 1. Fetch or create user profile
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, role, full_name")
        .eq("id", data.user.id)
        .single();

      let role = existingProfile?.role;

      if (!existingProfile) {
        const metadata = data.user.user_metadata || {};
        const fullName =
          metadata.full_name ||
          metadata.name ||
          data.user.email?.split("@")[0] ||
          "Seeker";
        const avatarUrl = metadata.avatar_url || metadata.picture || null;

        await supabase.from("profiles").upsert(
          {
            id: data.user.id,
            full_name: fullName,
            avatar_url: avatarUrl,
            role: "user",
          },
          { onConflict: "id" }
        );
        role = "user";
      }

      // 2. Consultant Intent: Route newly logged in user directly to /apply
      if (intent === "consultant" && role !== "consultant") {
        return NextResponse.redirect(`${origin}/apply`);
      }

      // 3. Smart Role-Based Redirect
      if (["admin", "superadmin", "super_admin"].includes(role || "")) {
        return NextResponse.redirect(`${origin}/admin/dashboard`);
      } else if (role === "consultant") {
        return NextResponse.redirect(`${origin}/consultant/dashboard`);
      } else {
        const destination =
          next && next !== "/" && next !== "/login" ? next : "/explore";
        return NextResponse.redirect(`${origin}${destination}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=OAuthAuthenticationFailed`);
}
