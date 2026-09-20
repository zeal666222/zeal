import type {Metadata} from "next";
import {Inter} from "next/font/google";
import "./globals.css";
import {GlobalCallListener} from "@/components/global/GlobalCallListener";
import {AppLayout, type Profile} from "@/components/navigation/AppLayout";
import {SupabaseAuthProvider} from "@/components/providers/SupabaseAuthProvider";
import {RealtimeProvider} from "@/components/providers/RealtimeProvider";
import {QueryProvider} from "@/lib/query/provider";
import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";

const inter = Inter({subsets: ["latin"]});

export const metadata: Metadata = {
  title: "Project Zeal | Metaphysical Consultations",
  description: "Enterprise-grade metaphysical consultation platform.",
};

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {cookies: {getAll() { return cookieStore.getAll(); }, setAll() {}}},
  );

  const {data: {user}} = await supabase.auth.getUser();

  let profile: Profile = null;
  if (user) {
    const {data} = await supabase
      .from("User")
      .select("id, role, wallet_balance, name, avatar")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      profile = {
        id: data.id,
        role: data.role as string,
        wallet_balance: Number(data.wallet_balance ?? 0),
        full_name: (data.name as string | null) ?? "",
        avatar_url: (data.avatar as string | null) ?? null,
      };
    }
  }

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-50 antialiased`}>
        <QueryProvider>
          <SupabaseAuthProvider>
            <RealtimeProvider>
              {user && <GlobalCallListener userId={user.id} />}
              <AppLayout user={user} profile={profile}>
                {children}
              </AppLayout>
            </RealtimeProvider>
          </SupabaseAuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
