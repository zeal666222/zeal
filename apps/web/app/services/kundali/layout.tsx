import type { Metadata } from "next";
import { SEO, SERVICE_FAQS } from "@/lib/seo/metadata";
import { FAQSchema, ServiceSchema, BreadcrumbSchema } from "@/components/seo/StructuredData";
import { RelatedServices } from "@/components/seo/RelatedServices";

export const metadata: Metadata = {
  title: SEO.kundali.title,
  description: SEO.kundali.description,
  keywords: SEO.kundali.keywords,
  openGraph: { title: SEO.kundali.title, description: SEO.kundali.description },
  twitter: { card: "summary_large_image", title: SEO.kundali.title, description: SEO.kundali.description },
};

export default function KundaliLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceSchema name="Free Janam Kundali — Vedic Birth Chart" description={SEO.kundali.description} url="/services/kundali" />
      <FAQSchema questions={SERVICE_FAQS.kundali} />
      <BreadcrumbSchema items={[{ name: "Home", url: "/" }, { name: "Services", url: "/services" }, { name: "Janam Kundali", url: "/services/kundali" }]} />
      {children}
      <div className="max-w-4xl mx-auto px-4 pb-12"><RelatedServices serviceKey="kundali" /></div>
    </>
  );
}
