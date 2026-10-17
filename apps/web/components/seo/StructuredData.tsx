export function OrganizationSchema() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://zeal.app";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Zeal",
    alternateName: "Project Zeal",
    url: siteUrl,
    logo: `${siteUrl}/icon-512.png`,
    description: "Zeal is a multi-faith spiritual consultation platform offering free astrology, tarot, kundali, numerology, palmistry, and dream interpretation. Connect with verified astrologers, healers, therapists, and AI consultants across Vedic, Western, and modern spiritual traditions.",
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      availableLanguage: ["English", "Hindi"],
    },
    foundingDate: "2025",
    areaServed: {
      "@type": "Place",
      name: "Worldwide",
    },
    knowsAbout: [
      "Vedic Astrology", "Western Astrology", "Tarot Card Reading",
      "Numerology", "Palmistry", "Kundali Matching", "Dream Interpretation",
      "Reiki Healing", "Meditation", "Yoga", "Vastu Shastra",
      "Birth Chart Analysis", "Horoscope", "Guna Milan",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function WebSiteSchema() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://zeal.app";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Zeal",
    url: siteUrl,
    description: "Free online astrology, tarot, kundali, numerology, palmistry & dream interpretation. Connect with verified spiritual consultants.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/explore?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function ServiceSchema({ name, description, url }: { name: string; description: string; url: string }) {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://zeal.app";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    url: url.startsWith("http") ? url : `${siteUrl}${url}`,
    provider: {
      "@type": "Organization",
      name: "Zeal",
      url: siteUrl,
    },
    serviceType: "Spiritual Consultation",
    areaServed: {
      "@type": "Place",
      name: "Worldwide",
    },
    availableChannel: {
      "@type": "ServiceChannel",
      serviceType: "Online",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free AI-powered reading available",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function FAQSchema({ questions }: { questions: Array<{ question: string; answer: string }> | undefined }) {
  if (!questions?.length) return null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function BreadcrumbSchema({ items }: { items: Array<{ name: string; url: string }> }) {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://zeal.app";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${siteUrl}${item.url}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

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
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://zeal.app";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    description,
    url: url.startsWith("http") ? url : `${siteUrl}${url}`,
    ...(image ? { image } : {}),
    ...(jobTitle ? { jobTitle } : {}),
    ...(knowsAbout?.length ? { knowsAbout } : {}),
    ...(address
      ? {
          address: {
            "@type": "PostalAddress",
            addressLocality: address,
            addressCountry: "IN",
          },
        }
      : {}),
    ...(rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.value,
            reviewCount: rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    worksFor: {
      "@type": "Organization",
      name: "Zeal",
      url: siteUrl,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
