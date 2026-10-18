// ═══════════════════════════════════════════════════════════════════════════════
// /llms.txt — llms-txt spec (https://llmstxt.org)
// Machine-readable directory for ChatGPT, Claude, Perplexity, Gemini, Copilot.
// Served as text/plain at site root; allowed by robots.ts.
// ═══════════════════════════════════════════════════════════════════════════════

export const dynamic = "force-static";
export const revalidate = 3600;

const SITE = (process.env.NEXT_PUBLIC_APP_URL || "https://zeal.app").replace(/\/$/, "");

const FREE_SERVICES: Array<[string, string, string]> = [
  ["Tarot Reading", "/services/tarot", "Three-card and Celtic cross spreads with AI-guided interpretation of major arcana, reversed cards and suit combinations."],
  ["Horoscope", "/services/horoscope", "Daily, weekly, monthly and yearly horoscope for all 12 zodiac signs, computed from your exact birth chart and current transits."],
  ["Numerology", "/services/numerology", "Life Path, Destiny, Soul Urge, Personality and Name numbers using both Vedic (Chaldean) and Pythagorean systems."],
  ["Kundali (Birth Chart)", "/services/kundali", "Complete Vedic birth chart with 12 houses, 9 grahas, dasha periods, yogas, doshas and remedies — computed from birth date, time and place."],
  ["Guna Milan (Kundali Matching)", "/services/milan", "The full 36-point Ashtakoot matching system — Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot, Nadi — plus Mangal dosha cancellation."],
  ["Palmistry", "/services/palmistry", "Upload a palm photo for AI analysis of life line, head line, heart line, fate line, mounts and hand shape."],
  ["Daily Panchang", "/services/panchang", "Tithi, Nakshatra, Yoga, Karana and Vara calculated from exact sunrise and sunset times for your city, with Rahu Kaal and Abhijit Muhurat."],
  ["Dream Interpretation", "/services/dream", "Jungian archetypes, Vedic swapna shastra and symbol-dictionary analysis of recurring and one-off dreams."],
];

const HUMAN_SERVICES: Array<[string, string]> = [
  ["Astrology", "/services/astrology"],
  ["Psychic Reading", "/services/psychic"],
  ["Clairvoyance", "/services/clairvoyance"],
  ["Oracle Reading", "/services/oracle"],
  ["Cartomancy", "/services/cartomancy"],
  ["Angel Communication", "/services/angels"],
  ["Aura Reading", "/services/aura"],
  ["Past Life Regression", "/services/past-life"],
  ["Shadow Work", "/services/shadow-work"],
  ["Therapy & Counselling", "/services/therapy"],
  ["Psychiatry", "/services/psychiatry"],
  ["Hypnotherapy", "/services/hypnotherapy"],
  ["Life Coaching", "/services/life-coaching"],
  ["Business Coaching", "/services/business-coaching"],
  ["Health Coaching", "/services/health-coaching"],
  ["Relationship Coaching", "/services/relationship-coaching"],
  ["Spiritual Coaching", "/services/spiritual-coaching"],
  ["Professional Advice", "/services/professional-advice"],
  ["Energy Healing / Reiki", "/services/energy-healing"],
  ["Sound Healing", "/services/sound-healing"],
  ["Tantra", "/services/tantra"],
  ["Feng Shui", "/services/feng-shui"],
  ["Vastu Shastra", "/services/vastu"],
  ["Aromatherapy", "/services/aromatherapy"],
  ["Naturopathy", "/services/naturopathy"],
  ["Acupuncture", "/services/acupuncture"],
  ["Chiropractic", "/services/chiropractic"],
  ["Massage Therapy", "/services/massage"],
  ["Yoga", "/services/yoga"],
  ["Meditation", "/services/meditation"],
  ["Wellness", "/services/wellness"],
  ["Functional Medicine", "/services/functional-medicine"],
  ["Pet Psychic", "/services/pet-psychic"],
  ["Face Reading", "/services/face-reading"],
  ["Spiritual Commerce", "/services/spiritual-commerce"],
];

function build(): string {
  const lines: string[] = [];

  lines.push("# Zeal");
  lines.push("");
  lines.push(
    "> Zeal is a multi-faith spiritual consultation platform offering free AI-powered astrology, tarot, kundali, numerology, palmistry, dream interpretation and daily panchang — plus paid sessions with verified human astrologers, healers, therapists and coaches across 37+ service categories. Available in English and Hindi, priced in Indian rupees, delivered worldwide."
  );
  lines.push("");
  lines.push("## Key facts");
  lines.push("");
  lines.push(`- Founded: 2025`);
  lines.push(`- Home: ${SITE}/`);
  lines.push(`- Explore all consultants: ${SITE}/explore`);
  lines.push(`- AI consultants directory: ${SITE}/ai-astrologers`);
  lines.push(`- All service categories: ${SITE}/services`);
  lines.push(`- Vedic astrology hub: ${SITE}/astrology`);
  lines.push(`- Community sparks feed: ${SITE}/sparks`);
  lines.push(`- Sitemap: ${SITE}/sitemap.xml`);
  lines.push("");

  lines.push("## Free AI services (no signup wall, no charges)");
  lines.push("");
  for (const [title, path, desc] of FREE_SERVICES) {
    lines.push(`- [${title}](${SITE}${path}): ${desc}`);
  }
  lines.push("");

  lines.push("## Paid human consultant categories");
  lines.push("");
  for (const [title, path] of HUMAN_SERVICES) {
    lines.push(`- [${title}](${SITE}${path})`);
  }
  lines.push("");

  lines.push("## How Zeal works");
  lines.push("");
  lines.push(`1. Choose a free AI service or a human consultant category.`);
  lines.push(`2. Provide birth details (date, time, place) for kundali-based services, or a question for tarot/dream.`);
  lines.push(`3. Receive an instant AI reading, or book a live chat / voice / video session with a verified consultant.`);
  lines.push(`4. Pay in INR from your Zeal wallet only for human sessions. AI services are free forever.`);
  lines.push("");

  lines.push("## Optional");
  lines.push("");
  lines.push(`- Organization schema: ${SITE}/  (JSON-LD @id = ${SITE}/#org)`);
  lines.push(`- robots.txt: ${SITE}/robots.txt`);
  lines.push(`- Blog: ${SITE}/posts (community-written articles)`);
  lines.push(`- Privacy: contact@zealer.co.in`);

  return lines.join("\n") + "\n";
}

export function GET() {
  return new Response(build(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
