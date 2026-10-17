import type { Metadata } from "next";
import { SEO, SERVICE_FAQS } from "@/lib/seo/metadata";
import { FAQSchema, ServiceSchema, BreadcrumbSchema } from "@/components/seo/StructuredData";
import { RelatedServices } from "@/components/seo/RelatedServices";

export const metadata: Metadata = {
  title: SEO.dream.title,
  description: SEO.dream.description,
  keywords: SEO.dream.keywords,
  openGraph: { title: SEO.dream.title, description: SEO.dream.description },
  twitter: { card: "summary_large_image", title: SEO.dream.title, description: SEO.dream.description },
};

export default function DreamLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceSchema name="AI Dream Interpretation" description={SEO.dream.description} url="/services/dream" />
      <FAQSchema questions={SERVICE_FAQS.dream} />
      <BreadcrumbSchema items={[{ name: "Home", url: "/" }, { name: "Services", url: "/services" }, { name: "Dream Interpretation", url: "/services/dream" }]} />
      {children}
      <div className="max-w-4xl mx-auto px-4 pb-12"><RelatedServices serviceKey="dream" /></div>
    </>
  );
}
