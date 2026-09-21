import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "@zeal/ui/tokens.css";
import { ThemeProvider } from "@zeal/ui/theme";
import { MotionProvider } from "@zeal/ui/motion";
import { GlobalCallListener } from "@/components/global/GlobalCallListener";
import { AppLayout, type Profile } from "@/components/navigation/AppLayout";
import { SupabaseAuthProvider } from "@/components/providers/SupabaseAuthProvider";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { QueryProvider } from "@/lib/query/provider";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
  preload: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

export const metadata: Metadata = {
  title: {
    default: "Project Zeal | Metaphysical Consultations",
    template: "%s · Zeal",
  },
  description: "Enterprise-grade metaphysical consultation platform.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://zeal.app"),
  openGraph: {
    type: "website",
    siteName: "Zeal",
    title: "Project Zeal — Metaphysical Consultations",
    description: "Connect with verified astrologers, healers, and AI consultants.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();

  let profile: Profile = null;
  if (user) {
    const { data } = await supabase
      .from("User")
      .select("id, role, name, avatar, wallet:Wallet!Wallet_userId_fkey(balance)")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      const wallet = (data as { wallet?: { balance?: number } | { balance?: number }[] }).wallet;
      const walletBalance = Array.isArray(wallet)
        ? Number(wallet[0]?.balance ?? 0)
        : Number(wallet?.balance ?? 0);

      profile = {
        id: data.id,
        role: data.role as string,
        wallet_balance: walletBalance,
        full_name: (data.name as string | null) ?? "",
        avatar_url: (data.avatar as string | null) ?? null,
      };
    }
  }

  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange={false}
          themes={["light", "dark"]}
        >
          <QueryProvider>
            <SupabaseAuthProvider>
              <RealtimeProvider>
                <MotionProvider>
                  {user && <GlobalCallListener userId={user.id} />}
                  <AppLayout user={user} profile={profile}>
                    <main id="main-content">{children}</main>
                  </AppLayout>
                </MotionProvider>
              </RealtimeProvider>
            </SupabaseAuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
