import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://zeal.app").replace(/\/$/, "");

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zeal — Astrology, Tarot & Spiritual Consultations",
    short_name: "Zeal",
    description: "Free online astrology, tarot, kundali, numerology, palmistry & dream interpretation. Connect with verified astrologers and AI consultants.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#7C3AED",
    orientation: "portrait-primary",
    categories: ["astrology", "spirituality", "lifestyle", "entertainment"],
    lang: "en",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Free Tarot", short_name: "Tarot", url: "/services/tarot" },
      { name: "Daily Horoscope", short_name: "Horoscope", url: "/services/horoscope" },
      { name: "Birth Chart", short_name: "Kundali", url: "/services/kundali" },
      { name: "Find Consultants", short_name: "Explore", url: "/explore" },
    ],
  };
}
