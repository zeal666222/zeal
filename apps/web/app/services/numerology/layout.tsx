import type { Metadata } from "next";
import { SEO, SERVICE_FAQS } from "@/lib/seo/metadata";
import { FAQSchema, ServiceSchema, BreadcrumbSchema } from "@/components/seo/StructuredData";
import { RelatedServices } from "@/components/seo/RelatedServices";

export const metadata: Metadata = {
  title: SEO.numerology.title,
  description: SEO.numerology.description,
  keywords: SEO.numerology.keywords,
  openGraph: { title: SEO.numerology.title, description: SEO.numerology.description },
  twitter: { card: "summary_large_image", title: SEO.numerology.title, description: SEO.numerology.description },
};

export default function NumerologyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceSchema name="Free Numerology Reading & Calculator" description={SEO.numerology.description} url="/services/numerology" />
      <FAQSchema questions={SERVICE_FAQS.numerology} />
      <BreadcrumbSchema items={[{ name: "Home", url: "/" }, { name: "Services", url: "/services" }, { name: "Numerology", url: "/services/numerology" }]} />
      {children}
      <div className="max-w-4xl mx-auto px-4 pb-12"><RelatedServices serviceKey="numerology" /></div>
    </>
  );
}
