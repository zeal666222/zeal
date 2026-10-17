import type { Metadata } from "next";
import { SEO, SERVICE_FAQS } from "@/lib/seo/metadata";
import { FAQSchema, ServiceSchema, BreadcrumbSchema } from "@/components/seo/StructuredData";
import { RelatedServices } from "@/components/seo/RelatedServices";

export const metadata: Metadata = {
  title: SEO.tarot.title,
  description: SEO.tarot.description,
  keywords: SEO.tarot.keywords,
  openGraph: { title: SEO.tarot.title, description: SEO.tarot.description },
  twitter: { card: "summary_large_image", title: SEO.tarot.title, description: SEO.tarot.description },
};

export default function TarotLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceSchema name="Free Online Tarot Card Reading" description={SEO.tarot.description} url="/services/tarot" />
      <FAQSchema questions={SERVICE_FAQS.tarot} />
      <BreadcrumbSchema items={[{ name: "Home", url: "/" }, { name: "Services", url: "/services" }, { name: "Tarot Card Reading", url: "/services/tarot" }]} />
      {children}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <RelatedServices serviceKey="tarot" />
      </div>
    </>
  );
}
