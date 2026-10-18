// ═══════════════════════════════════════════════════════════════════════════════
// StructuredData — JSON-LD for SEO + AEO + GEO
//
//   AEO (Answer Engine Optimization)  → FAQPage, HowTo, Speakable, precise answers
//   GEO (Generative Engine Opt.)      → Organization/WebSite/SoftwareApplication
//                                        with stable @id cross-refs so every entity
//                                        is a single canonical node across the graph.
//
// Every schema below reuses SITE/ORG/APP ids. Google and LLM crawlers treat
// these @id references as authoritative entity signals — they are the difference
// between "a page about astrology" and "Zeal, the astrology platform".
// ═══════════════════════════════════════════════════════════════════════════════

const SITE = (process.env.NEXT_PUBLIC_APP_URL || "https://zeal.app").replace(/\/$/, "");

export const ORG_ID = `${SITE}/#organization`;
export const SITE_ID = `${SITE}/#website`;
export const APP_ID = `${SITE}/#softwareapplication`;

function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

function abs(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${SITE}${url.startsWith("/") ? "" : "/"}${url}`;
}

// ─── Organization ─────────────────────────────────────────────────────────────
// The single authoritative entity for Zeal. Referenced by every other schema
// via ORG_ID. Includes sameAs placeholder, aggregateRating hook, contact.
export function OrganizationSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": ORG_ID,
        name: "Zeal",
        alternateName: "Project Zeal",
        url: SITE,
        logo: {
          "@type": "ImageObject",
          "@id": `${ORG_ID}/logo`,
          url: `${SITE}/icon-512.png`,
          width: 512,
          height: 512,
        },
        image: `${SITE}/og-image.png`,
        description:
          "Zeal is a multi-faith spiritual consultation platform offering free astrology, tarot, kundali, numerology, palmistry, panchang and dream interpretation. Connect with verified astrologers, healers, therapists and AI consultants across Vedic, Western and modern spiritual traditions.",
        slogan: "Ancient wisdom. Instant answers. Fair prices.",
        foundingDate: "2025",
        areaServed: { "@type": "Place", name: "Worldwide" },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          availableLanguage: ["English", "Hindi"],
          email: "contact@zealer.co.in",
        },
        knowsAbout: [
          "Vedic Astrology",
          "Western Astrology",
          "Tarot Card Reading",
          "Numerology",
          "Palmistry",
          "Kundali Matching",
          "Guna Milan",
          "Dream Interpretation",
          "Daily Panchang",
          "Reiki Healing",
          "Meditation",
          "Yoga",
          "Vastu Shastra",
          "Birth Chart Analysis",
          "Horoscope",
        ],
        sameAs: [],
      }}
    />
  );
}

// ─── WebSite ──────────────────────────────────────────────────────────────────
// Publisher @id links this back to the Organization node. Sitelinks Searchbox
// is triggered by the SearchAction potentialAction.
export function WebSiteSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": SITE_ID,
        url: SITE,
        name: "Zeal",
        alternateName: "Project Zeal",
        description:
          "Free online astrology, tarot, kundali, numerology, palmistry and dream interpretation. Connect with verified spiritual consultants worldwide.",
        inLanguage: ["en-IN", "en-US", "hi-IN"],
        publisher: { "@id": ORG_ID },
        copyrightHolder: { "@id": ORG_ID },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE}/explore?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      }}
    />
  );
}

// ─── SoftwareApplication ──────────────────────────────────────────────────────
// Anchors Zeal as a *product*, not just a website. This is the schema Google
// surfaces for brand-knowledge-panel and app-search results, and the one
// Perplexity/Claude cite when asked "what is Zeal?".
export function SoftwareApplicationSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "@id": APP_ID,
        name: "Zeal",
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web, iOS, Android",
        url: SITE,
        description:
          "Multi-faith spiritual consultation platform with free AI-powered astrology, tarot, kundali, numerology, palmistry, panchang and dream reading — plus paid live sessions with verified human consultants.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "INR",
          availability: "https://schema.org/InStock",
          description: "Free AI services; pay-per-minute human consultations from ₹9/min",
        },
        featureList: [
          "Free AI astrology readings",
          "Gamified tarot card draws",
          "Vedic Janam Kundali with dasha periods",
          "36-point Ashtakoot Guna Milan",
          "Daily Panchang with Rahu Kaal",
          "Palm photo analysis (vision AI)",
          "Jungian dream interpretation",
          "Real-time chat with verified consultants",
          "Voice and video consultations",
          "Wallet-based billing in INR",
          "Hinglish + English AI responses",
        ],
        publisher: { "@id": ORG_ID },
        isAccessibleForFree: true,
        inLanguage: ["en-IN", "hi-IN"],
      }}
    />
  );
}

// ─── Service ──────────────────────────────────────────────────────────────────
// Provider is referenced by @id so all 37+ service nodes share the same
// Organization entity. Optional features + rating let Google render
// Rich Results with review stars.
export function ServiceSchema({
  name,
  description,
  url,
  serviceType = "Spiritual Consultation",
  features,
  rating,
}: {
  name: string;
  description: string;
  url: string;
  serviceType?: string | string[];
  features?: string[];
  rating?: { value: number; count: number };
}) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${abs(url)}#service`,
    name,
    description,
    url: abs(url),
    provider: { "@id": ORG_ID },
    serviceType,
    areaServed: { "@type": "Place", name: "Worldwide" },
    availableChannel: {
      "@type": "ServiceChannel",
      serviceType: "Online",
      name: "Zeal web app",
      availableLanguage: ["English", "Hindi"],
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      description: "Free AI-powered reading, no signup wall.",
      url: abs(url),
    },
  };
  if (features?.length)
    (jsonLd as { featureList?: string[] }).featureList = features;
  if (rating)
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating.value,
      reviewCount: rating.count,
      bestRating: 5,
      worstRating: 1,
    };
  return <JsonLd data={jsonLd} />;
}

// ─── FAQPage ──────────────────────────────────────────────────────────────────
// AEO workhorse. Each question must be answered in the rendered HTML too
// (Google requires the JSON-LD text to match visible text). 50-100 word
// answers perform best for AI answer engines (ChatGPT/Perplexity cite them).
export function FAQSchema({
  questions,
}: {
  questions:
    | Array<{ question: string; answer: string }>
    | undefined;
}) {
  if (!questions?.length) return null;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": `${SITE}/faqs`,
        mainEntity: questions.map((q) => ({
          "@type": "Question",
          name: q.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: q.answer,
          },
        })),
        publisher: { "@id": ORG_ID },
      }}
    />
  );
}

// ─── HowTo ────────────────────────────────────────────────────────────────────
// Renders "3 steps to X" rich results. Use on any service page with a
// setup flow. totalTime MUST be ISO-8601 duration (e.g. PT2M for 2 min).
export function HowToSchema({
  name,
  description,
  url,
  totalTime,
  steps,
  image,
}: {
  name: string;
  description: string;
  url: string;
  totalTime: string;
  steps: Array<{ name: string; text?: string; image?: string; url?: string }>;
  image?: string;
}) {
  if (!steps?.length) return null;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "HowTo",
        "@id": `${abs(url)}#howto`,
        name,
        description,
        url: abs(url),
        totalTime,
        ...(image ? { image } : {}),
        step: steps.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.name,
          ...(s.text ? { itemListElement: [{ "@type": "HowToDirection", text: s.text }] } : {}),
          ...(s.image ? { image: s.image } : {}),
          ...(s.url ? { url: abs(s.url) } : {}),
        })),
      }}
    />
  );
}

// ─── Speakable ────────────────────────────────────────────────────────────────
// Signals to Google Assistant / Siri / Alexa which parts of the page are
// suitable for read-aloud. cssSelector must target real DOM nodes.
// Recommended: the summary paragraph + the "Key Takeaways" list.
export function SpeakableSchema({
  cssSelector,
  url,
}: {
  cssSelector: string[];
  url?: string;
}) {
  if (!cssSelector?.length) return null;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${abs(url ?? "/")}#webpage`,
        url: abs(url ?? "/"),
        speakable: {
          "@type": "SpeakableSpecification",
          cssSelector,
        },
      }}
    />
  );
}

// ─── BreadcrumbList ───────────────────────────────────────────────────────────
export function BreadcrumbSchema({
  items,
}: {
  items: Array<{ name: string; url: string }>;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          item: abs(item.url),
        })),
      }}
    />
  );
}

// ─── Person (consultants) ─────────────────────────────────────────────────────
// Google uses this to build knowledge-panel cards for consultant names.
// worksFor is an @id reference so the Person entity is anchored to Zeal's
// Organization node across all 38+ consultant pages.
export function PersonSchema({
  name,
  description,
  url,
  image,
  jobTitle,
  knowsAbout,
  address,
  rating,
}: {
  name: string;
  description: string;
  url: string;
  image?: string;
  jobTitle?: string;
  knowsAbout?: string[];
  address?: string;
  rating?: { value: number; count: number };
}) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${abs(url)}#person`,
    name,
    description,
    url: abs(url),
    worksFor: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
  };
  if (image) jsonLd.image = image;
  if (jobTitle) jsonLd.jobTitle = jobTitle;
  if (knowsAbout?.length) jsonLd.knowsAbout = knowsAbout;
  if (address)
    jsonLd.address = {
      "@type": "PostalAddress",
      addressLocality: address,
      addressCountry: "IN",
    };
  if (rating)
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating.value,
      reviewCount: rating.count,
      bestRating: 5,
      worstRating: 1,
    };
  return <JsonLd data={jsonLd} />;
}

// ─── BlogPosting ──────────────────────────────────────────────────────────────
// For /post/[id] pages. wordCount is a strong AEO signal — ChatGPT and
// Perplexity prefer 800-2000 word articles for citation.
export function BlogPostingSchema({
  headline,
  description,
  url,
  datePublished,
  dateModified,
  author,
  image,
  wordCount,
  tags,
}: {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  author?: { name: string; url?: string };
  image?: string;
  wordCount?: number;
  tags?: string[];
}) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${abs(url)}#article`,
    headline,
    description,
    url: abs(url),
    datePublished,
    dateModified: dateModified ?? datePublished,
    inLanguage: "en-IN",
    isPartOf: { "@id": SITE_ID },
    publisher: { "@id": ORG_ID },
  };
  if (author)
    jsonLd.author = {
      "@type": "Person",
      name: author.name,
      ...(author.url ? { url: abs(author.url) } : {}),
    };
  if (image) jsonLd.image = image;
  if (wordCount) jsonLd.wordCount = wordCount;
  if (tags?.length) jsonLd.keywords = tags.join(", ");
  return <JsonLd data={jsonLd} />;
}

// ─── ItemList (service directory / explore) ───────────────────────────────────
// Tells Google + LLMs the page is a canonical, ordered collection.
// Drives "Best X near me" and "Top X" AI answers.
export function ItemListSchema({
  name,
  description,
  url,
  items,
}: {
  name: string;
  description?: string;
  url: string;
  items: Array<{ name: string; url: string; image?: string }>;
}) {
  if (!items?.length) return null;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        "@id": `${abs(url)}#list`,
        name,
        ...(description ? { description } : {}),
        url: abs(url),
        numberOfItems: items.length,
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        itemListElement: items.map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: it.name,
          url: abs(it.url),
          ...(it.image ? { image: it.image } : {}),
        })),
      }}
    />
  );
}
