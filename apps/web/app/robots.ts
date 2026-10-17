import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://zeal.app").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/services/", "/explore", "/ai-astrologers/", "/u/", "/post/", "/astrology", "/sparks"],
        disallow: [
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
        ],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
      },
      {
        userAgent: "GPTBot",
        allow: ["/", "/services/", "/explore", "/ai-astrologers/", "/astrology"],
      },
      {
        userAgent: "ChatGPT-User",
        allow: ["/", "/services/", "/explore"],
      },
      {
        userAgent: "PerplexityBot",
        allow: ["/", "/services/", "/explore"],
      },
      {
        userAgent: "ClaudeBot",
        allow: ["/", "/services/", "/explore"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
