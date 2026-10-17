import type { Metadata } from "next";
import { SEO } from "@/lib/seo/metadata";
import { BreadcrumbSchema } from "@/components/seo/StructuredData";

export const metadata: Metadata = {
  title: SEO.aiAstrologers.title,
  description: SEO.aiAstrologers.description,
  keywords: SEO.aiAstrologers.keywords,
  openGraph: { title: SEO.aiAstrologers.title, description: SEO.aiAstrologers.description },
  twitter: { card: "summary_large_image", title: SEO.aiAstrologers.title, description: SEO.aiAstrologers.description },
};

export default function AiAstrologersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbSchema items={[{ name: "Home", url: "/" }, { name: "AI Astrologers", url: "/ai-astrologers" }]} />
      {children}
    </>
  );
}
