import type { Metadata } from "next";
import { SEO, SERVICE_FAQS } from "@/lib/seo/metadata";
import { FAQSchema, ServiceSchema, BreadcrumbSchema } from "@/components/seo/StructuredData";
import { RelatedServices } from "@/components/seo/RelatedServices";

export const metadata: Metadata = {
  title: SEO.horoscope.title,
  description: SEO.horoscope.description,
  keywords: SEO.horoscope.keywords,
  openGraph: { title: SEO.horoscope.title, description: SEO.horoscope.description },
  twitter: { card: "summary_large_image", title: SEO.horoscope.title, description: SEO.horoscope.description },
};

export default function HoroscopeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceSchema name="Daily Horoscope — Free Rashifal" description={SEO.horoscope.description} url="/services/horoscope" />
      <FAQSchema questions={SERVICE_FAQS.horoscope} />
      <BreadcrumbSchema items={[{ name: "Home", url: "/" }, { name: "Services", url: "/services" }, { name: "Daily Horoscope", url: "/services/horoscope" }]} />
      {children}
      <div className="max-w-4xl mx-auto px-4 pb-12"><RelatedServices serviceKey="horoscope" /></div>
    </>
  );
}
