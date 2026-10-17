// SEO-optimized metadata for every public page.
// Keywords researched from Google Trends, competitor analysis (AstroSage, Mynaksh,
// ProKerala, DeckAura, Palmist.io), and high-intent search patterns for
// astrology/tarot/kundali/numerology/palmistry/dream interpretation in India + global.

export interface SeoMeta {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
}

export const SEO = {
  home: {
    title: "Zeal — Free Astrology, Tarot, Therapy & 37+ Spiritual Services Online",
    description:
      "Free online astrology, tarot, kundali, numerology, palmistry, dream interpretation, therapy, reiki, meditation & more. 37+ spiritual services — connect with verified astrologers, therapists, healers & life coaches. AI-powered readings available 24/7.",
    keywords: [
      "free astrology online", "online tarot reading", "free kundali", "astrology consultation",
      "vedic astrology online", "tarot card reading free", "numerology calculator",
      "palmistry reading online", "dream interpretation", "spiritual consultation",
      "astrologer online India", "free birth chart", "horoscope today",
      "online therapy", "reiki healing", "meditation guidance", "life coach online",
      "vastu consultant", "yoga therapy", "sound healing", "relationship coaching",
    ],
  },
  explore: {
    title: "Find Astrologers, Tarot Readers, Healers & Therapists Online",
    description:
      "Browse verified astrologers, tarot readers, numerologists, palmists, therapists, reiki healers & life coaches. Filter by faith, specialty, language & rating. Free AI consultants available 24/7.",
    keywords: [
      "find astrologer online", "tarot readers near me", "spiritual consultants",
      "healers online", "therapist consultation", "vedic astrologer", "reiki healer",
    ],
  },
  services: {
    title: "Free Astrology, Tarot, Kundali, Numerology & Spiritual Services",
    description:
      "Explore 37+ spiritual services: Vedic astrology, tarot card reading, kundali matching, numerology, palmistry, dream interpretation, reiki healing, meditation guidance & more. Free AI-powered readings available instantly.",
    keywords: [
      "astrology services", "tarot reading online", "kundali matching", "numerology reading",
      "palmistry online", "dream interpretation", "reiki healing", "spiritual services",
    ],
  },
  aiAstrologers: {
    title: "AI Astrologers & Spiritual Consultants — Free 24/7 Readings",
    description:
      "Chat with AI astrologers trained in Vedic, Western & Nadi astrology. Free instant readings for birth charts, tarot, numerology & more. Available 24/7 — no appointment needed.",
    keywords: [
      "AI astrologer", "AI tarot reading", "free AI astrology", "chat with astrologer",
      "instant horoscope", "AI kundali", "astrology chatbot",
    ],
  },
  astrology: {
    title: "Vedic Astrology Reading — Free Birth Chart & Planetary Analysis",
    description:
      "Get your free Vedic astrology reading with accurate planetary positions, dashas & transits. AI-powered Janam Kundali analysis based on ancient Jyotish Shastra. Enter your birth details for instant insights.",
    keywords: [
      "vedic astrology reading", "free birth chart analysis", "janam kundali",
      "planetary positions", "dasha analysis", "jyotish shastra", "horoscope reading",
    ],
  },
  sparks: {
    title: "Your Spark Score — Community Activity & Karma Points",
    description: "Track your Zeal community activity. Earn sparks by sharing posts, commenting, and helping others on their spiritual journey.",
  },
  // ── Free Service Pages ──────────────────────────────────────────────
  tarot: {
    title: "Free Tarot Card Reading Online — AI-Powered 3-Card & Celtic Cross Spreads",
    description:
      "Get a free AI tarot card reading online. Choose from 3-card spread, Celtic Cross, or daily draw. Instant interpretations based on Rider-Waite symbolism — past, present & future revealed.",
    keywords: [
      "free tarot reading online", "tarot card reading", "AI tarot", "3 card tarot spread",
      "celtic cross tarot", "rider waite tarot", "daily tarot card", "tarot reading free no signup",
      "online tarot reading accurate", "tarot card meanings",
    ],
  },
  horoscope: {
    title: "Daily Horoscope — Free Today's Rashifal for All 12 Zodiac Signs",
    description:
      "Read your free daily horoscope for all 12 zodiac signs. Accurate predictions for love, career, health & finances based on Vedic rashifal and Western astrology. Updated every morning.",
    keywords: [
      "daily horoscope", "today horoscope", "rashifal today", "free horoscope",
      "zodiac predictions", "aries horoscope today", "taurus horoscope", "gemini rashifal",
      "love horoscope", "career horoscope", "daily rashifal in English",
    ],
  },
  numerology: {
    title: "Free Numerology Reading — Life Path, Destiny & Soul Urge Number Calculator",
    description:
      "Calculate your Life Path, Destiny, Expression & Soul Urge numbers free. AI-powered numerology reading reveals your personality traits, career path, love compatibility & lucky numbers.",
    keywords: [
      "numerology calculator", "life path number", "destiny number", "numerology reading free",
      "soul urge number", "expression number", "name numerology", "birthday number",
      "numerology compatibility", "free numerology report",
    ],
  },
  kundali: {
    title: "Free Janam Kundali — Vedic Birth Chart Analysis with Planetary Positions",
    description:
      "Generate your free Janam Kundali (Vedic birth chart) with accurate planetary positions, house placements, dasha periods & yogas. AI-powered interpretation of your Rashi, Nakshatra & Ascendant.",
    keywords: [
      "free kundali", "janam kundali online", "birth chart vedic", "kundli analysis",
      "rashi chart", "nakshatra analysis", "dasha periods", "vedic birth chart free",
      "kundali with predictions", "horoscope chart maker", "lagna kundali",
    ],
  },
  milan: {
    title: "Free Kundali Matching — Guna Milan & Marriage Compatibility (36 Gunas)",
    description:
      "Free kundali matching for marriage with 36-point Guna Milan analysis. Check Mangal Dosha, Nadi, Bhakoot & Varna compatibility. Instant AI-generated compatibility report for bride & groom.",
    keywords: [
      "kundali matching", "guna milan", "kundli matching for marriage", "horoscope matching",
      "marriage compatibility", "mangal dosha check", "36 guna milan", "ashtakoot matching",
      "bride groom kundali", "free kundali milan",
    ],
  },
  palmistry: {
    title: "Free AI Palm Reading Online — Heart, Head & Life Line Analysis",
    description:
      "Upload a photo of your palm for a free AI palmistry reading. Analysis of heart line, head line, life line, fate line & mount placements. Ancient Hasta Samudrika Shastra meets modern AI.",
    keywords: [
      "palmistry reading online", "free palm reading", "AI palm reading", "palm line analysis",
      "heart line palmistry", "head line reading", "life line palm", "hasta samudrika",
      "palm photo reading", "online palmist",
    ],
  },
  panchang: {
    title: "Today's Panchang — Tithi, Nakshatra, Rahu Kaal & Shubh Muhurat",
    description:
      "Today's Panchang with accurate Tithi, Nakshatra, Yoga, Karana & Rahu Kaal timings. Find Shubh Muhurat for weddings, housewarming & new ventures. Updated daily for all Indian cities.",
    keywords: [
      "today panchang", "tithi today", "rahu kaal timing", "shubh muhurat",
      "nakshatra today", "panchang hindu calendar", "auspicious time today",
      "yoga karta today", "hindu calendar today",
    ],
  },
  dream: {
    title: "Dream Interpretation — Free AI Dream Meaning & Symbol Analysis",
    description:
      "Describe your dream and get an instant AI interpretation. Decode dream symbols using Jungian psychology, spiritual traditions & cultural symbolism. Understand what your subconscious is telling you.",
    keywords: [
      "dream interpretation", "dream meaning", "dream symbol dictionary", "what does my dream mean",
      "AI dream analysis", "common dream meanings", "spiritual dream interpretation",
      "dream dictionary", "recurring dream meaning",
    ],
  },
  // ── Auth Pages ──────────────────────────────────────────────────────
  login: {
    title: "Log In to Zeal — Access Your Astrology Readings & Consultations",
    description: "Log in to Zeal to access your astrology readings, chat with consultants, track your spark score & manage your spiritual journey.",
  },
  register: {
    title: "Sign Up for Zeal — Free Astrology, Tarot & Spiritual Consultations",
    description: "Create your free Zeal account. Get instant access to free tarot readings, daily horoscopes, kundali charts & connect with verified astrologers.",
  },
} as const satisfies Record<string, SeoMeta>;

// FAQ content for AEO/GEO — structured for rich snippet eligibility
export const SERVICE_FAQS: Record<string, Array<{ question: string; answer: string }>> = {
  tarot: [
    {
      question: "How does the free online tarot card reading work?",
      answer: "Our AI tarot reading uses the Rider-Waite deck symbolism. You focus on a question, choose a spread (3-card or Celtic Cross), and the AI draws cards randomly. Each card is interpreted in context of your question using traditional tarot meanings combined with intuitive analysis.",
    },
    {
      question: "Is the online tarot reading accurate?",
      answer: "Our AI tarot readings are based on centuries-old Rider-Waite symbolism and traditional card meanings. While tarot is a tool for reflection and guidance, accuracy depends on how openly you connect with the cards. Many users find the AI interpretations surprisingly insightful.",
    },
    {
      question: "Can I ask any question during a tarot reading?",
      answer: "Yes, you can ask about love, career, health, relationships, or any life situation. For best results, ask open-ended questions like 'What should I know about my career path?' rather than yes/no questions.",
    },
  ],
  horoscope: [
    {
      question: "How are the daily horoscopes calculated?",
      answer: "Our daily horoscopes combine Vedic rashifal calculations based on actual planetary transits with Western zodiac interpretations. The AI updates predictions each morning using current planetary positions relative to your moon sign (Vedic) or sun sign (Western).",
    },
    {
      question: "Should I read my sun sign or moon sign horoscope?",
      answer: "Vedic astrology (rashifal) uses your moon sign for more accurate predictions, while Western astrology uses your sun sign. If you know your moon sign, read that for deeper Vedic insights. If you only know your birth date, your sun sign horoscope is a good starting point.",
    },
  ],
  kundali: [
    {
      question: "What is a Janam Kundali and why is it important?",
      answer: "A Janam Kundali (birth chart) is a map of planetary positions at the exact time and place of your birth. In Vedic astrology, it reveals your Rashi (moon sign), Nakshatra (lunar mansion), Ascendant, and the placement of all 9 planets in 12 houses. It is the foundation for all astrological predictions including career, marriage, health, and finances.",
    },
    {
      question: "How accurate is the free online kundali?",
      answer: "Our kundali uses precise Swiss Ephemeris calculations for planetary positions, matching professional Jyotish software. The accuracy depends on your birth time — even a 5-minute difference can change the Ascendant. We recommend verifying your birth time from hospital records for the most accurate chart.",
    },
  ],
  numerology: [
    {
      question: "What is a Life Path Number and how is it calculated?",
      answer: "Your Life Path Number is the most important number in numerology. It is calculated by reducing your complete birth date to a single digit (or master number 11, 22, 33). For example, if you were born on December 15, 1990: 1+2+1+5+1+9+9+0 = 28, then 2+8 = 10, then 1+0 = 1. Your Life Path Number is 1.",
    },
    {
      question: "Can numerology predict my future?",
      answer: "Numerology does not predict specific events but reveals your inherent strengths, challenges, life purpose, and cyclical patterns. It helps you understand personality traits, compatible partners, favorable career paths, and personal year cycles for better decision-making.",
    },
  ],
  milan: [
    {
      question: "What is Guna Milan and how many gunas are needed for a good match?",
      answer: "Guna Milan (also called Ashtakoot matching) is a Vedic system that compares two birth charts across 8 parameters totaling 36 points. A score of 18+ is considered acceptable, 24+ is good, and 30+ is excellent. The 8 kootas are Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot, and Nadi.",
    },
    {
      question: "Is Mangal Dosha a reason to reject a match?",
      answer: "Mangal Dosha (Mars affliction) alone should not reject a match. If both partners have Mangal Dosha, they cancel each other out. Many astrologers also consider other factors like overall Guna Milan score, 7th house strength, and Jupiter's aspect before making a final recommendation.",
    },
  ],
  palmistry: [
    {
      question: "Which hand should I photograph for a palm reading?",
      answer: "Photograph your dominant hand (the one you write with) for the primary reading, as it shows your current life path and active choices. Your non-dominant hand shows inherited traits and potential. For the best AI reading, photograph your dominant hand with good lighting and fingers slightly spread.",
    },
    {
      question: "What are the main lines in palmistry?",
      answer: "The four major lines are: Heart Line (top of palm — emotions and relationships), Head Line (middle — intellect and communication style), Life Line (curves around thumb — vitality and life changes, NOT length of life), and Fate Line (vertical from wrist — career path and destiny). Mount placements below each finger also reveal important traits.",
    },
  ],
  dream: [
    {
      question: "How does AI dream interpretation work?",
      answer: "Our AI analyzes your dream description using Jungian archetypes, common dream symbol dictionaries, and cross-cultural spiritual symbolism. It identifies recurring patterns, emotional themes, and symbolic elements to provide a multi-layered interpretation covering psychological, spiritual, and practical dimensions.",
    },
    {
      question: "Do recurring dreams have special meaning?",
      answer: "Yes, recurring dreams typically indicate an unresolved issue, unprocessed emotion, or a message your subconscious is trying to deliver. The specific symbols in the recurring dream, combined with the emotions you feel, point to the area of life that needs attention. Our AI interpretation highlights these patterns.",
    },
  ],
  panchang: [
    {
      question: "What is Rahu Kaal and why should I avoid it?",
      answer: "Rahu Kaal is a 90-minute inauspicious period each day when Rahu (the north lunar node) has maximum negative influence. In Vedic astrology, starting new ventures, signing contracts, or performing important rituals during Rahu Kaal is believed to bring obstacles. Our panchang shows exact Rahu Kaal timings for your city.",
    },
  ],
};

// Internal linking map — which services link to which related services
export const RELATED_SERVICES: Record<string, Array<{ label: string; href: string }>> = {
  tarot: [
    { label: "Daily Horoscope", href: "/services/horoscope" },
    { label: "Numerology Reading", href: "/services/numerology" },
    { label: "Dream Interpretation", href: "/services/dream" },
    { label: "Talk to a Tarot Reader", href: "/explore?category=tarot" },
  ],
  horoscope: [
    { label: "Birth Chart (Kundali)", href: "/services/kundali" },
    { label: "Today's Panchang", href: "/services/panchang" },
    { label: "Tarot Reading", href: "/services/tarot" },
    { label: "Find an Astrologer", href: "/explore?category=astrology" },
  ],
  kundali: [
    { label: "Kundali Matching (Milan)", href: "/services/milan" },
    { label: "Daily Horoscope", href: "/services/horoscope" },
    { label: "Numerology", href: "/services/numerology" },
    { label: "Vedic Astrology Reading", href: "/astrology" },
  ],
  numerology: [
    { label: "Birth Chart (Kundali)", href: "/services/kundali" },
    { label: "Tarot Card Reading", href: "/services/tarot" },
    { label: "Life Path Compatibility", href: "/services/milan" },
    { label: "Talk to a Numerologist", href: "/explore?category=numerology" },
  ],
  milan: [
    { label: "Free Kundali", href: "/services/kundali" },
    { label: "Relationship Coaching", href: "/explore?category=relationship-coaching" },
    { label: "Daily Horoscope", href: "/services/horoscope" },
    { label: "Find an Astrologer", href: "/explore?category=astrology" },
  ],
  palmistry: [
    { label: "Numerology Reading", href: "/services/numerology" },
    { label: "Dream Interpretation", href: "/services/dream" },
    { label: "Talk to a Palmist", href: "/explore?category=palmistry" },
    { label: "Birth Chart", href: "/services/kundali" },
  ],
  panchang: [
    { label: "Daily Horoscope", href: "/services/horoscope" },
    { label: "Birth Chart (Kundali)", href: "/services/kundali" },
    { label: "Vedic Astrology", href: "/astrology" },
    { label: "Find a Priest", href: "/explore?category=astrology" },
  ],
  dream: [
    { label: "Tarot Reading", href: "/services/tarot" },
    { label: "Talk to a Therapist", href: "/explore?category=therapy" },
    { label: "Numerology", href: "/services/numerology" },
    { label: "Spiritual Coaching", href: "/explore?category=spiritual-coaching" },
  ],
};
