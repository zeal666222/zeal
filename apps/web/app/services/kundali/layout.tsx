import type { Metadata } from "next";
import { SEO, SERVICE_FAQS } from "@/lib/seo/metadata";
import {
  FAQSchema,
  ServiceSchema,
  BreadcrumbSchema,
  HowToSchema,
} from "@/components/seo/StructuredData";
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
      <ServiceSchema
        name="Free Janam Kundali — Vedic Birth Chart"
        description={SEO.kundali.description}
        url="/services/kundali"
        serviceType={["Vedic Astrology", "Birth Chart Analysis", "Jyotish"]}
        features={[
          "12 bhavas / houses",
          "9 grahas / planets",
          "Vimshottari dasha (120-year timeline)",
          "300+ yogas detected",
          "Mangal, Kaal, Sarpal, Pitra dosha analysis",
          "Self-consistency verification checks",
          "AI Jyotishi interpretation",
          "Gemstone and mantra remedies",
        ]}
      />
      <FAQSchema questions={SERVICE_FAQS.kundali} />
      <HowToSchema
        name="How to get your free Janam Kundali on Zeal"
        description="Three deterministic steps — compute the Vedic chart from your birth details, verify it against self-consistency anchors, then read the AI Jyotishi interpretation."
        url="/services/kundali"
        totalTime="PT2M"
        steps={[
          {
            name: "1. Chart Computation",
            text: "The deterministic Vedic engine computes exact planetary positions, Bhavas, Nakshatras and Dasha — all 9 grahas, the same result every time.",
          },
          {
            name: "2. Verification First",
            text: "Along with the chart you get self-consistency checks and past-Dasha anchors — match them yourself and build your trust.",
          },
          {
            name: "3. Jyotishi Interpretation",
            text: "The Jyotishi AI interprets your real computed chart — background analysis, past-event verification, then the road ahead.",
          },
        ]}
      />
      <BreadcrumbSchema items={[{ name: "Home", url: "/" }, { name: "Services", url: "/services" }, { name: "Janam Kundali", url: "/services/kundali" }]} />
      {children}
      <div className="max-w-4xl mx-auto px-4 pb-12"><RelatedServices serviceKey="kundali" /></div>
    </>
  );
}
