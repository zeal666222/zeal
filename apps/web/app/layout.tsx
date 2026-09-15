import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServerNav } from "@/components/navigation/ServerNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Project Zeal | Metaphysical Consultations",
  description: "Enterprise-grade metaphysical consultation platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-50 antialiased min-h-screen flex flex-col`}>
        {/* The ServerNav securely decides if it should render itself or not */}
        <ServerNav />
        
        {/* Main application content */}
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
