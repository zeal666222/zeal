import type { Metadata } from "next";
import { SEO, SERVICE_FAQS } from "@/lib/seo/metadata";
import { FAQSchema, ServiceSchema, BreadcrumbSchema } from "@/components/seo/StructuredData";
import { RelatedServices } from "@/components/seo/RelatedServices";

export const metadata: Metadata = {
  title: SEO.palmistry.title,
  description: SEO.palmistry.description,
  keywords: SEO.palmistry.keywords,
  openGraph: { title: SEO.palmistry.title, description: SEO.palmistry.description },
  twitter: { card: "summary_large_image", title: SEO.palmistry.title, description: SEO.palmistry.description },
};

export default function PalmistryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceSchema name="Free AI Palm Reading Online" description={SEO.palmistry.description} url="/services/palmistry" />
      <FAQSchema questions={SERVICE_FAQS.palmistry} />
      <BreadcrumbSchema items={[{ name: "Home", url: "/" }, { name: "Services", url: "/services" }, { name: "Palm Reading", url: "/services/palmistry" }]} />
      {children}
      <div className="max-w-4xl mx-auto px-4 pb-12"><RelatedServices serviceKey="palmistry" /></div>
    </>
  );
}
