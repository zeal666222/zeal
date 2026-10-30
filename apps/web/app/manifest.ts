import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://zealer.co.in").replace(/\/$/, "");

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Zeal — Astrology, Tarot & Spiritual Consultations",
    short_name: "Zeal",
    description: "Free online astrology, tarot, kundali, numerology, palmistry & dream interpretation. Connect with verified astrologers and AI consultants.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    launch_handler: { client_mode: "focus-existing" },
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    orientation: "portrait-primary",
    categories: ["astrology", "spirituality", "lifestyle", "entertainment"],
    lang: "en",
    dir: "ltr",
    prefer_related_applications: false,
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
