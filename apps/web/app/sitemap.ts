import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://zealer.co.in").replace(/\/$/, "");

const STATIC_PAGES: Array<{ url: string; priority: number; changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"] }> = [
  { url: "/", priority: 1.0, changeFrequency: "daily" },
  { url: "/explore", priority: 0.9, changeFrequency: "daily" },
  { url: "/services", priority: 0.9, changeFrequency: "weekly" },
  { url: "/ai-astrologers", priority: 0.8, changeFrequency: "weekly" },
  { url: "/services/tarot", priority: 0.9, changeFrequency: "daily" },
  { url: "/services/horoscope", priority: 0.9, changeFrequency: "daily" },
  { url: "/services/numerology", priority: 0.85, changeFrequency: "weekly" },
  { url: "/services/kundali", priority: 0.9, changeFrequency: "weekly" },
  { url: "/services/milan", priority: 0.85, changeFrequency: "weekly" },
  { url: "/services/palmistry", priority: 0.85, changeFrequency: "weekly" },
  { url: "/services/panchang", priority: 0.8, changeFrequency: "daily" },
  { url: "/services/dream", priority: 0.8, changeFrequency: "weekly" },
  { url: "/astrology", priority: 0.8, changeFrequency: "weekly" },
  { url: "/sparks", priority: 0.6, changeFrequency: "daily" },
];

const SERVICE_CATEGORIES = [
  "astrology", "tarot", "numerology", "palmistry", "psychic", "clairvoyance",
  "dreams", "angels", "aura", "cartomancy", "past-life", "shadow-work",
  "therapy", "psychiatry", "life-coaching", "wellness", "energy-healing",
  "professional-advice", "spiritual-commerce", "sound-healing", "yoga",
  "meditation", "hypnotherapy", "feng-shui", "pet-psychic", "oracle",
  "face-reading", "business-coaching", "health-coaching", "relationship-coaching",
  "spiritual-coaching", "functional-medicine", "tantra", "aromatherapy",
  "naturopathy", "acupuncture", "chiropractic", "massage",
];

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();
  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
    url: `${SITE_URL}${p.url}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  for (const cat of SERVICE_CATEGORIES) {
    entries.push({
      url: `${SITE_URL}/services/${cat}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  const admin = getSupabaseAdmin();
  if (admin) {
    // Human consultant pages. "User" has no isArchived column and no
    // "consultant" role value — the role column carries USER / CLIENT_ADMIN /
    // AI — so this used to error out and quietly contribute zero profile URLs.
    // Verified consultants are found through the Consultant table instead.
    const { data: verified } = await admin
      .from("Consultant")
      .select("userId")
      .eq("status", "VERIFIED")
      .eq("isActive", true);
    const consultantIds = [...new Set((verified ?? []).map((c: { userId: string }) => c.userId))];

    if (consultantIds.length > 0) {
      const { data: consultants } = await admin
        .from("User")
        .select("id, username, updatedAt")
        .in("id", consultantIds);

      for (const c of consultants ?? []) {
        const slug = c.username || c.id;
        entries.push({
          url: `${SITE_URL}/u/${slug}`,
          lastModified: c.updatedAt ? new Date(c.updatedAt).toISOString() : now,
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    }

    const { data: aiConsultants } = await admin
      .from("AIConsultant")
      .select("id, username, updatedAt")
      .eq("isActive", true);

    if (aiConsultants) {
      for (const c of aiConsultants) {
        const slug = c.username || c.id;
        entries.push({
          url: `${SITE_URL}/ai-astrologers/${slug}`,
          lastModified: c.updatedAt ? new Date(c.updatedAt).toISOString() : now,
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }

    const { data: posts } = await admin
      .from("Post")
      .select("id, createdAt")
      .eq("isArchived", false)
      .order("createdAt", { ascending: false })
      .limit(500);

    if (posts) {
      for (const p of posts) {
        entries.push({
          url: `${SITE_URL}/post/${p.id}`,
          lastModified: new Date(p.createdAt).toISOString(),
          changeFrequency: "monthly",
          priority: 0.5,
        });
      }
    }
  }

  return entries;
}
