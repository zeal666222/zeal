import type { Metadata } from "next";
import { SEO } from "@/lib/seo/metadata";
import { BreadcrumbSchema } from "@/components/seo/StructuredData";

export const metadata: Metadata = {
  title: SEO.astrology.title,
  description: SEO.astrology.description,
  keywords: SEO.astrology.keywords,
  openGraph: { title: SEO.astrology.title, description: SEO.astrology.description },
  twitter: { card: "summary_large_image", title: SEO.astrology.title, description: SEO.astrology.description },
};

export default function AstrologyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbSchema items={[{ name: "Home", url: "/" }, { name: "Vedic Astrology", url: "/astrology" }]} />
      {children}
    </>
  );
}
