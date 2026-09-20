import { Inter, JetBrains_Mono } from "next/font/google";
import "@zeal/ui/tokens.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SupabaseAuthProvider } from "@/components/providers/SupabaseAuthProvider";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { QueryProvider } from "@/lib/query/provider";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin – Zeal",
  description: "Admin dashboard for Zeal platform",
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
  preload: false,
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-900 antialiased">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          themes={["light", "dark"]}
          disableTransitionOnChange
        >
          <QueryProvider>
            <SupabaseAuthProvider>
              <RealtimeProvider>
                <div id="main-content">{children}</div>
              </RealtimeProvider>
            </SupabaseAuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
