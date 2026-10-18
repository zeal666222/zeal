import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "@zeal/ui/tokens.css";
import { ThemeProvider } from "@zeal/ui/theme";
import { MotionProvider, SmoothScroll } from "@zeal/ui/motion";
import { GlobalCallListener } from "@/components/global/GlobalCallListener";
import { GlobalLoader } from "@/components/global/GlobalLoader";
import { AppLayout, type Profile } from "@/components/navigation/AppLayout";
import { SupabaseAuthProvider } from "@/components/providers/SupabaseAuthProvider";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { QueryProvider } from "@/lib/query/provider";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ThemeScript } from "@zeal/ui/theme-script";
import { Toaster } from "@/components/ui/toaster";
import { OrganizationSchema, WebSiteSchema, SoftwareApplicationSchema } from "@/components/seo/StructuredData";

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
    default: "Zeal — Free Astrology, Tarot, Therapy & 37+ Spiritual Services Online",
    template: "%s | Zeal",
  },
  description:
    "Free online astrology, tarot, kundali, numerology, palmistry, dream interpretation, therapy, reiki, meditation & more. 37+ spiritual services — connect with verified astrologers, therapists, healers & life coaches. AI-powered readings available 24/7.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://zeal.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "Zeal",
    title: "Zeal — Free Astrology, Tarot, Therapy & 37+ Spiritual Services",
    description:
      "37+ spiritual services: astrology, tarot, kundali, numerology, therapy, reiki, meditation & more. Free AI readings 24/7 or connect with verified experts.",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Zeal — Free Astrology, Tarot & Spiritual Consultations",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zeal — Free Astrology, Tarot & Spiritual Consultations",
    description:
      "Free online astrology, tarot, kundali, numerology & more. Connect with verified astrologers and AI consultants.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  category: "spirituality",
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
      .select("id, role, name, avatar, wallet:Wallet!userId(balance)")
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
      <head>
        <ThemeScript />
        <OrganizationSchema />
        <WebSiteSchema />
        <SoftwareApplicationSchema />
      </head>
      <body className="antialiased">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <GlobalLoader />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange={true}
          themes={["light", "dark"]}
        >
          <QueryProvider>
            <SupabaseAuthProvider>
              <RealtimeProvider>
                <MotionProvider>
                  <SmoothScroll>

                  {user && <GlobalCallListener userId={user.id} />}
                  <AppLayout user={user} profile={profile}>
                    {children}
                  </AppLayout>

                  </SmoothScroll>
                </MotionProvider>
              </RealtimeProvider>
            </SupabaseAuthProvider>
          </QueryProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
