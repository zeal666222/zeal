import type { Metadata } from "next";
import { SEO, SERVICE_FAQS } from "@/lib/seo/metadata";
import { FAQSchema, ServiceSchema, BreadcrumbSchema } from "@/components/seo/StructuredData";
import { RelatedServices } from "@/components/seo/RelatedServices";

export const metadata: Metadata = {
  title: SEO.milan.title,
  description: SEO.milan.description,
  keywords: SEO.milan.keywords,
  openGraph: { title: SEO.milan.title, description: SEO.milan.description },
  twitter: { card: "summary_large_image", title: SEO.milan.title, description: SEO.milan.description },
};

export default function MilanLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceSchema name="Free Kundali Matching — Guna Milan" description={SEO.milan.description} url="/services/milan" />
      <FAQSchema questions={SERVICE_FAQS.milan} />
      <BreadcrumbSchema items={[{ name: "Home", url: "/" }, { name: "Services", url: "/services" }, { name: "Kundali Matching", url: "/services/milan" }]} />
      {children}
      <div className="max-w-4xl mx-auto px-4 pb-12"><RelatedServices serviceKey="milan" /></div>
    </>
  );
}
