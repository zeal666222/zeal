import type { Metadata } from "next";
import { SEO, SERVICE_FAQS } from "@/lib/seo/metadata";
import { FAQSchema, ServiceSchema, BreadcrumbSchema } from "@/components/seo/StructuredData";
import { RelatedServices } from "@/components/seo/RelatedServices";

export const metadata: Metadata = {
  title: SEO.panchang.title,
  description: SEO.panchang.description,
  keywords: SEO.panchang.keywords,
  openGraph: { title: SEO.panchang.title, description: SEO.panchang.description },
  twitter: { card: "summary_large_image", title: SEO.panchang.title, description: SEO.panchang.description },
};

export default function PanchangLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceSchema name="Today's Panchang — Tithi, Nakshatra & Rahu Kaal" description={SEO.panchang.description} url="/services/panchang" />
      <FAQSchema questions={SERVICE_FAQS.panchang} />
      <BreadcrumbSchema items={[{ name: "Home", url: "/" }, { name: "Services", url: "/services" }, { name: "Daily Panchang", url: "/services/panchang" }]} />
      {children}
      <div className="max-w-4xl mx-auto px-4 pb-12"><RelatedServices serviceKey="panchang" /></div>
    </>
  );
}
