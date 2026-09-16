import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServerNav } from "@/components/navigation/ServerNav";
import { GlobalCallListener } from "@/components/global/GlobalCallListener";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Project Zeal | Metaphysical Consultations",
  description: "Enterprise-grade metaphysical consultation platform.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Check if a user is logged in to mount their personal real-time listener
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-50 antialiased min-h-screen flex flex-col`}>
        {/* Global UI Components */}
        <ServerNav />
        {user && <GlobalCallListener userId={user.id} />}
        
        {/* Main application content */}
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
