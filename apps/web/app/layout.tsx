import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { BottomBar } from "@/components/layout/BottomBar";

export const metadata: Metadata = {
  title: "Zeal — Multi-Faith Wellness Platform",
  description: "Enterprise-grade wellness and AI consultation workspace.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      {/* pb-28 ensures desktop and mobile content stops before hitting the bottom bar */}
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 antialiased selection:bg-purple-500/30 pb-28">
        <Navbar />
        <main>{children}</main>
        <BottomBar />
      </body>
    </html>
  );
}
