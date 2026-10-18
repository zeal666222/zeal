import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://zeal.app").replace(/\/$/, "");

// Public, indexable surfaces. Anything not listed is user-private or API.
const ALLOW = [
  "/",
  "/services",
  "/services/",
  "/explore",
  "/ai-astrologers",
  "/ai-astrologers/",
  "/u/",
  "/post/",
  "/astrology",
  "/sparks",
  "/sitemap.xml",
  "/llms.txt",
];

const DISALLOW = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/mfa-challenge",
  "/onboarding",
  "/profile",
  "/create",
  "/bookings",
  "/booking",
  "/wallet",
  "/payment/",
  "/session/",
  "/chat/",
  "/notifications",
  "/debug",
  "/apply",
  "/consultant/dashboard",
  "/consultant/availability",
  "/consultant/bookings",
  "/consultant/clients",
  "/consultant/earnings",
  "/consultant/pending",
  "/consultant/onboarding",
  "/consultant/settings",
  "/admin",
  "/white-label/",
  "/api/",
  "/_next/",
  "/cdn-cgi/",
];

// AI/LLM crawlers we intentionally welcome for AEO + GEO.
// Each is scoped to public paths only.
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "Claude-User",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "GoogleOther",
  "Bingbot",
  "bingbot",
  "DuckAssistBot",
  "Applebot",
  "CCBot",
  "cohere-ai",
  "MistralAI",
  "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ALLOW,
        disallow: DISALLOW,
      },
      {
        userAgent: "Googlebot",
        allow: ["/"],
        disallow: ["/api/", "/admin", "/profile", "/chat/", "/wallet", "/bookings", "/payment/", "/session/"],
      },
      {
        userAgent: "Bingbot",
        allow: ["/"],
        disallow: ["/api/", "/admin", "/profile", "/chat/", "/wallet", "/bookings", "/payment/", "/session/"],
      },
      // Safari/Apple searches are powered by Bing; Applebot crawls for Siri + Widgets.
      {
        userAgent: "Applebot",
        allow: ALLOW,
        disallow: DISALLOW,
      },
      ...AI_CRAWLERS.map((ua) => ({
        userAgent: ua,
        allow: ALLOW,
        disallow: DISALLOW,
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
