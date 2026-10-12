// ============================================================================
// 27 Nakshatras — Meanings, Rulers, Deities, and Interpretations
// ============================================================================

export interface NakshatraInfo {
  number: number;
  name: string;
  sanskrit: string;
  star: string; // Western star name
  range: [number, number]; // start degree, end degree (0-360)
  lord: string; // Dasha lord
  deity: string;
  symbol: string;
  nature: "deva" | "manusha" | "rakshasa"; // divine, human, or demonic
  quality: "fixed" | "soft" | "fierce" | "mixed" | "light";
  element: "fire" | "earth" | "air" | "water";
  interpretation: string;
  career: string;
  relationships: string;
  keywords: string[];
}

export const NAKSHATRA_DATA: NakshatraInfo[] = [
  {
    number: 1, name: "Ashwini", sanskrit: "अश्विनी", star: "Beta & Gamma Arietis",
    range: [0, 13.333], lord: "Ketu", deity: "Ashwini Kumaras (Divine Physicians)",
    symbol: "Horse head", nature: "deva", quality: "light", element: "fire",
    interpretation: "Ashwini natives are swift, healing, and pioneering. They have natural medical ability and a desire to help others. Speed and new beginnings are their gift. Restlessness can be a challenge.",
    career: "Medicine, healing, pharmaceuticals, racing, transportation, emergency services, veterinary science.",
    relationships: "Quick to fall in love. Needs an independent partner. Healing relationships. May marry young.",
    keywords: ["ashwini", "healing", "speed", "pioneering", "medical", "horses", "new beginnings"],
  },
  {
    number: 2, name: "Bharani", sanskrit: "भरणी", star: "35 & 41 Arietis",
    range: [13.333, 26.667], lord: "Venus", deity: "Yama (God of Death)",
    symbol: "Yoni (female organ)", nature: "manusha", quality: "fierce", element: "fire",
    interpretation: "Bharani natives have intense transformative power. They handle life's extremes — birth and death, creation and destruction. Bearing and nurturing are their gifts. May face reproductive health issues.",
    career: "Law, justice, midwifery, funeral services, transformation coaching, art dealing.",
    relationships: "Intense, passionate relationships. Transformative partnerships. May face loss in relationships that leads to growth.",
    keywords: ["bharani", "transformation", "bearing", "intense", "yama", "death", "rebirth"],
  },
  {
    number: 3, name: "Krittika", sanskrit: "कृत्तिका", star: "Pleiades (Six Sisters)",
    range: [26.667, 40], lord: "Sun", deity: "Agni (God of Fire)",
    symbol: "Knife or razor", nature: "rakshasa", quality: "mixed", element: "fire",
    interpretation: "Krittika natives are sharp, purifying, and determined. Like fire, they can warm or burn. They cut through illusion and have strong digestive fire. May be overly critical. Spiritual purification is their path.",
    career: "Cooking, metallurgy, surgery, criticism/editing, fire-related industries, military.",
    relationships: "Sharp in relationships. Needs a partner who can handle directness. Purifying relationships. May cut ties abruptly.",
    keywords: ["krittika", "fire", "agni", "sharp", "purifying", "critical", "determined"],
  },
  {
    number: 4, name: "Rohini", sanskrit: "रोहिणी", star: "Aldebaran (Alpha Tauri)",
    range: [40, 53.333], lord: "Moon", deity: "Brahma (Creator)",
    symbol: "Cart or chariot", nature: "manusha", quality: "fixed", element: "earth",
    interpretation: "Rohini natives are creative, fertile, and beautiful. They have natural artistic talent and love of luxury. Growth and abundance are their birthright. May be possessive or overly attached to comfort.",
    career: "Arts, agriculture, fashion, real estate, luxury goods, banking, creative industries.",
    relationships: "Charming and attractive to partners. Deeply loving but may be possessive. Marriage brings material growth.",
    keywords: ["rohini", "creative", "beautiful", "fertile", "luxury", "growth", "artistic"],
  },
  {
    number: 5, name: "Mrigashira", sanskrit: "मृगशिरा", star: "Lambda Orionis",
    range: [53.333, 66.667], lord: "Mars", deity: "Soma (Moon God)",
    symbol: "Deer head", nature: "manusha", quality: "soft", element: "earth",
    interpretation: "Mrigashira natives are searching, gentle, and curious. They are always seeking — knowledge, beauty, truth. Travel and exploration are their nature. Restlessness comes from the eternal search.",
    career: "Research, travel, writing, perfumery, gardening, investigation, exploration.",
    relationships: "Searching for the ideal partner. Gentle and romantic. May be indecisive in love. Travel partner is important.",
    keywords: ["mrigashira", "searching", "gentle", "curious", "travel", "seeking", "deer"],
  },
  {
    number: 6, name: "Ardra", sanskrit: "आर्द्रा", star: "Betelgeuse (Alpha Orionis)",
    range: [66.667, 80], lord: "Rahu", deity: "Rudra (Storm God)",
    symbol: "Teardrop or thunderbolt", nature: "manusha", quality: "fierce", element: "air",
    interpretation: "Ardra natives experience life through storms and tears. They have transformative emotional depth and may face sudden upheavals that lead to growth. Like rain after storm, they bring renewal. Research and investigation are natural.",
    career: "Research, science, psychology, weather-related work, demolition, transformation coaching.",
    relationships: "Emotional storms in relationships. Deep transformation through partnerships. May face betrayal that leads to wisdom.",
    keywords: ["ardra", "storm", "teardrop", "transformation", "research", "emotional depth", "renewal"],
  },
  {
    number: 7, name: "Punarvasu", sanskrit: "पुनर्वसु", star: "Castor & Pollux (Gemini)",
    range: [80, 93.333], lord: "Jupiter", deity: "Aditi (Mother of Gods)",
    symbol: "Bow and quiver of arrows", nature: "deva", quality: "light", element: "air",
    interpretation: "Punarvasu means 'return of light'. Natives have the gift of recovery and renewal. After every fall, they rise again. Homecoming and spiritual return are their themes. Optimism and faith are strengths.",
    career: "Teaching, real estate, architecture, counseling, spiritual guidance, agriculture.",
    relationships: "Return to home and family. Marriage brings stability. May return to former partners. Domestic happiness is important.",
    keywords: ["punarvasu", "renewal", "return", "home", "optimism", "recovery", "faith"],
  },
  {
    number: 8, name: "Pushya", sanskrit: "पुष्य", star: "Beehive Cluster (Cancer)",
    range: [93.333, 106.667], lord: "Saturn", deity: "Brihaspati (Jupiter/Guru of Gods)",
    symbol: "Flower or circle", nature: "deva", quality: "light", element: "earth",
    interpretation: "Pushya is the most auspicious nakshatra. Natives are nurturing, spiritual, and prosperous. They nourish others and are nourished by the divine. All auspicious activities are strengthened by Pushya. Religious and charitable nature.",
    career: "Teaching, religion, charity, food service, agriculture, counseling, public service.",
    relationships: "Nurturing partner. Family-oriented. Marriage is blessed with children and prosperity. Spiritual partnership.",
    keywords: ["pushya", "auspicious", "nurturing", "spiritual", "prosperous", "nourishing", "religious"],
  },
  {
    number: 9, name: "Ashlesha", sanskrit: "आश्लेषा", star: "Hydra cluster",
    range: [106.667, 120], lord: "Mercury", deity: "Sarpa (Serpent)",
    symbol: "Coiled serpent", nature: "rakshasa", quality: "fierce", element: "fire",
    interpretation: "Ashlesha natives have hypnotic, penetrating power. Like the serpent, they coil around their goals. Occult and mystical abilities are strong. May be misunderstood as manipulative. Kundalini energy is activated.",
    career: "Occult, psychology, politics, poison/medicine, research, tantra, healing through touch.",
    relationships: "Intense, hypnotic attraction. May have obsessive relationships. Sexual energy is powerful. Transformation through intimacy.",
    keywords: ["ashlesha", "serpent", "hypnotic", "occult", "penetrating", "kundalini", "mystical"],
  },
  {
    number: 10, name: "Magha", sanskrit: "मघा", star: "Regulus (Alpha Leonis)",
    range: [120, 133.333], lord: "Ketu", deity: "Pitris (Ancestors)",
    symbol: "Royal throne", nature: "rakshasa", quality: "fierce", element: "fire",
    interpretation: "Magha natives have royal bearing and strong connection to ancestors. Authority and lineage are important. They carry forward family traditions. May be authoritarian but are generous. Ancestral worship is important.",
    career: "Government, royalty, historical research, genealogy, administration, leadership.",
    relationships: "Royal treatment in relationships. Family tradition is important. May marry within same culture. Ancestral blessings help marriage.",
    keywords: ["magha", "royal", "ancestors", "authority", "lineage", "tradition", "throne"],
  },
  {
    number: 11, name: "Purva Phalguni", sanskrit: "पूर्व फाल्गुनी", star: "Regulus & others (Leo)",
    range: [133.333, 146.667], lord: "Venus", deity: "Bhaga (God of marital bliss)",
    symbol: "Front legs of bed or fig tree", nature: "manusha", quality: "fixed", element: "fire",
    interpretation: "Purva Phalguni natives love pleasure, relaxation, and procreation. They enjoy life's comforts and are generous hosts. Marriage and creativity are central. May be lazy but are deeply creative.",
    career: "Arts, entertainment, hospitality, marriage counseling, music, dance.",
    relationships: "Marriage is the central theme. Romantic and sensual. Bhaga's grace brings marital happiness. Creative partnerships flourish.",
    keywords: ["purva phalguni", "pleasure", "marriage", "creativity", "relaxation", "generosity", "bhaga"],
  },
  {
    number: 12, name: "Uttara Phalguni", sanskrit: "उत्तर फाल्गुनी", star: "Denebola (Beta Leonis)",
    range: [146.667, 160], lord: "Sun", deity: "Aryaman (God of patronage)",
    symbol: "Back legs of bed or fig tree", nature: "manusha", quality: "fixed", element: "fire",
    interpretation: "Uttara Phalguni natives are helpful, patronizing, and socially responsible. They manage others' welfare and provide patronage. Marriage brings social status. Friendship and social service are important.",
    career: "Social service, administration, patronage, marriage counseling, management, charity.",
    relationships: "Marriage brings social standing. Helpful partner. Social obligations through marriage. Friendship is the basis of love.",
    keywords: ["uttara phalguni", "helpful", "patronage", "social service", "marriage", "friendship", "management"],
  },
  {
    number: 13, name: "Hasta", sanskrit: "हस्त", star: "Corvus constellation",
    range: [160, 173.333], lord: "Moon", deity: "Savitar (Sun God of creativity)",
    symbol: "Hand or fist", nature: "deva", quality: "light", element: "earth",
    interpretation: "Hasta natives have skillful hands and clever minds. They are artisans, healers, and tricksters. Manual dexterity and mental agility are gifts. May use cleverness for good or ill. Healing through hands.",
    career: "Surgery, handicrafts, magic/illusion, jewelry, healing arts, sleight of hand, engineering.",
    relationships: "Clever in relationships. Skillful partner. May use charm and wit. Manual expression of love.",
    keywords: ["hasta", "skillful", "hands", "clever", "healing", "artisan", "dexterity"],
  },
  {
    number: 14, name: "Chitra", sanskrit: "चित्रा", star: "Spica (Alpha Virginis)",
    range: [173.333, 186.667], lord: "Mars", deity: "Vishwakarma (Divine Architect)",
    symbol: "Bright jewel or pearl", nature: "rakshasa", quality: "soft", element: "earth",
    interpretation: "Chitra natives are brilliant, artistic, and architecturally gifted. They create beauty and order. Fashion, design, and architecture are natural fields. May be vain but are genuinely talented. The divine architect's blessing.",
    career: "Architecture, fashion, design, jewelry, engineering, art, photography, film.",
    relationships: "Attracted to beauty in partners. May be overly concerned with appearance. Creative partnerships. Marriage to an artistic person.",
    keywords: ["chitra", "brilliant", "artistic", "architecture", "design", "beauty", "jewel"],
  },
  {
    number: 15, name: "Swati", sanskrit: "स्वाती", star: "Arcturus (Alpha Bootis)",
    range: [186.667, 200], lord: "Rahu", deity: "Vayu (Wind God)",
    symbol: "Coral or young plant in wind", nature: "deva", quality: "soft", element: "air",
    interpretation: "Swati natives are independent, flexible, and business-minded. Like wind, they cannot be held down. Trade and commerce are natural. Self-reliance is their strength. May be restless but adapt easily.",
    career: "Business, trade, import/export, travel, aviation, environmental science, wind energy.",
    relationships: "Independent in relationships. Needs freedom. Business partnerships are stronger than romantic ones. May travel away from partner.",
    keywords: ["swati", "independent", "flexible", "business", "trade", "wind", "self-reliant"],
  },
  {
    number: 16, name: "Vishakha", sanskrit: "विशाखा", star: "Alpha & Beta Librae",
    range: [200, 213.333], lord: "Jupiter", deity: "Indra-Agni (King of Gods & Fire God)",
    symbol: "Triumphal arch or potter's wheel", nature: "rakshasa", quality: "mixed", element: "fire",
    interpretation: "Vishakha natives are goal-oriented and determined. Like the potter's wheel, they shape their destiny through persistent effort. They have one-pointed focus and achieve through single-minded dedication. Spiritual ambition is strong.",
    career: "Politics, spiritual leadership, research, competitive sports, law, diplomacy.",
    relationships: "Focused on finding the right partner. May be overly goal-oriented in love. Spiritual partnership is ideal. Determination in relationships.",
    keywords: ["vishakha", "goal-oriented", "determined", "one-pointed", "ambitious", "spiritual", "potter's wheel"],
  },
  {
    number: 17, name: "Anuradha", sanskrit: "अनुराधा", star: "Delta & others (Scorpio)",
    range: [213.333, 226.667], lord: "Saturn", deity: "Mitra (God of friendship)",
    symbol: "Triumphal arch or lotus", nature: "deva", quality: "soft", element: "fire",
    interpretation: "Anuradha natives excel in friendship, devotion, and organizational work. They are loyal friends and devoted partners. Foreign travel and settlement are common. May face loneliness despite social success. Devotion (bhakti) is their path.",
    career: "Administration, foreign service, religious organizations, counseling, social work.",
    relationships: "Devoted partner. Friendship is the basis of love. May face separation from loved ones. Foreign spouse possible.",
    keywords: ["anuradha", "devotion", "friendship", "loyal", "foreign", "organizational", "bhakti"],
  },
  {
    number: 18, name: "Jyeshtha", sanskrit: "ज्येष्ठा", star: "Antares (Alpha Scorpii)",
    range: [226.667, 240], lord: "Mercury", deity: "Indra (King of Gods)",
    symbol: "Earring or umbrella", nature: "rakshasa", quality: "fierce", element: "fire",
    interpretation: "Jyeshtha means 'the eldest'. Natives are senior, authoritative, and protective. They are natural leaders who protect the vulnerable. May face jealousy from others. Seniority and experience are respected. Hidden enemies are a challenge.",
    career: "Leadership, politics, military command, protective services, administration, occult.",
    relationships: "Protective partner. May be controlling. Senior partner or age-gap marriage. Protection of family is paramount.",
    keywords: ["jyeshtha", "eldest", "authority", "protective", "leadership", "senior", "indra"],
  },
  {
    number: 19, name: "Moola", sanskrit: "मूला", star: "Lambda Scorpii & others",
    range: [240, 253.333], lord: "Ketu", deity: "Nirriti (Goddess of destruction)",
    symbol: "Tied bunch of roots", nature: "rakshasa", quality: "fierce", element: "fire",
    interpretation: "Moola natives are rooted in the deepest truths. They uproot evil and investigate fundamentals. Destruction of what is false is their gift. May face major life destructions that lead to truth. Research and philosophy are natural.",
    career: "Research, philosophy, medicine (especially herbal), detective work, spiritual teaching.",
    relationships: "Root-level transformation through relationships. May face complete destruction of relationships that leads to rebirth. Deep, primal connections.",
    keywords: ["moola", "roots", "destruction", "research", "fundamental", "truth", "uprooting"],
  },
  {
    number: 20, name: "Purva Ashadha", sanskrit: "पूर्व आषाढा", star: "Delta Sagittarii",
    range: [253.333, 266.667], lord: "Venus", deity: "Apas (Water God)",
    symbol: "Elephant tusk or winnowing basket", nature: "manusha", quality: "fierce", element: "water",
    interpretation: "Purva Ashadha natives are invincible and cannot be defeated. They have the water element's power — flowing around obstacles. Invincibility and popularity are their gifts. May be overconfident but rarely truly defeated.",
    career: "Navy, water-related work, law, public speaking, performing arts, diplomacy.",
    relationships: "Popular and attractive. Many admirers. Water connections in relationships. Invincible in love — always bounces back.",
    keywords: ["purva ashadha", "invincible", "water", "popular", "unconquerable", "flowing", "confidence"],
  },
  {
    number: 21, name: "Uttara Ashadha", sanskrit: "उत्तर आषाढा", star: "Sigma & Zeta Sagittarii",
    range: [266.667, 280], lord: "Sun", deity: "Vishvadevas (Universal Gods)",
    symbol: "Elephant tusk or small bed", nature: "manusha", quality: "fixed", element: "earth",
    interpretation: "Uttara Ashadha natives are universally victorious. They achieve lasting success that benefits all. Leadership with righteousness. May face early struggles but achieve permanent victory. Social reform is their calling.",
    career: "Leadership, social reform, military, government, universal causes, administration.",
    relationships: "Victorious in partnerships. Marriage brings universal benefit. Righteous partner. Lasting union.",
    keywords: ["uttara ashadha", "victorious", "universal", "righteous", "leadership", "permanent success"],
  },
  {
    number: 22, name: "Shravana", sanskrit: "श्रवण", star: "Altair (Alpha Aquilae)",
    range: [280, 293.333], lord: "Moon", deity: "Vishnu (Preserver)",
    symbol: "Ear or three footprints", nature: "deva", quality: "soft", element: "earth",
    interpretation: "Shravana means 'hearing'. Natives are great listeners, learners, and communicators. They absorb knowledge like ears absorb sound. Education, music, and language are gifts. Pilgrimage and learning from all sources.",
    career: "Education, music, languages, translation, listening/counseling, pilgrimage guide.",
    relationships: "Good listener as partner. Learns from relationships. Musical romance. Pilgrimage with partner.",
    keywords: ["shravana", "hearing", "learning", "communication", "education", "music", "vishnu"],
  },
  {
    number: 23, name: "Dhanishtha", sanskrit: "धनिष्ठा", star: "Beta & others (Delphinus)",
    range: [293.333, 306.667], lord: "Mars", deity: "Eight Vasus (Elemental Gods)",
    symbol: "Drum (damaru) or flute", nature: "rakshasa", quality: "fierce", element: "earth",
    interpretation: "Dhanishtha means 'wealthiest'. Natives are blessed with wealth, music, and infrastructure. They build lasting structures and enjoy material abundance. Musical talent is common. May be overly materialistic.",
    career: "Music, real estate, infrastructure, banking, engineering, charity organizations.",
    relationships: "Wealthy through marriage. Musical partner. Infrastructure builder. Material abundance in partnerships.",
    keywords: ["dhanishtha", "wealth", "music", "infrastructure", "building", "abundance", "vasus"],
  },
  {
    number: 24, name: "Shatabhisha", sanskrit: "शतभिषा", star: "Lambda Aquarii & others",
    range: [306.667, 320], lord: "Rahu", deity: "Varuna (God of cosmic waters)",
    symbol: "Empty circle or hundred flowers", nature: "rakshasa", quality: "soft", element: "air",
    interpretation: "Shatabhisha means 'hundred physicians'. Natives have healing power and mystical insight. They can heal a hundred diseases. Independent, mysterious, and technologically inclined. Healing through unconventional methods.",
    career: "Medicine, astronomy, technology, healing, astrology, research, space science.",
    relationships: "Mysterious in relationships. Heals partner. May keep secrets. Independent within partnership. Unconventional love.",
    keywords: ["shatabhisha", "healing", "mystical", "hundred", "technology", "independent", "varuna"],
  },
  {
    number: 25, name: "Purva Bhadrapada", sanskrit: "पूर्व भाद्रपद", star: "Alpha & Beta Pegasi",
    range: [320, 333.333], lord: "Jupiter", deity: "Aja Ekapada (One-footed Goat/Fire)",
    symbol: "Two-fronted man or sword", nature: "manusha", quality: "fierce", element: "fire",
    interpretation: "Purva Bhadrapada natives have fiery spiritual ambition. They burn with desire for the highest truth. Two-faced (seeing both material and spiritual worlds). May face inner fire that needs channeling. Ascetic tendencies.",
    career: "Spiritual teaching, fire-related industries, philosophy, research, warfare, asceticism.",
    relationships: "Intense spiritual partner. May struggle between material and spiritual love. Fiery passion. Transformation through partnership.",
    keywords: ["purva bhadrapada", "fiery", "spiritual ambition", "ascetic", "two-faced", "truth-seeking"],
  },
  {
    number: 26, name: "Uttara Bhadrapada", sanskrit: "उत्तर भाद्रपद", star: "Gamma Pegasi & Alpha Andromedae",
    range: [333.333, 346.667], lord: "Saturn", deity: "Ahir Budhnya (Serpent of the Deep)",
    symbol: "Twins or serpent in water", nature: "manusha", quality: "soft", element: "earth",
    interpretation: "Uttara Bhadrapada natives are wise, deep, and spiritually mature. They carry the wisdom of the serpent of the deep. Calm exterior hides immense inner power. Teacher and counselor abilities. Wealth comes from deep knowledge.",
    career: "Teaching, counseling, oceanography, deep research, spiritual guidance, treasury.",
    relationships: "Wise partner. Deep, calm love. Spiritual companionship. Twin-like bond with partner. Serpent wisdom in relationships.",
    keywords: ["uttara bhadrapada", "wise", "deep", "serpent", "spiritual maturity", "teacher", "calm"],
  },
  {
    number: 27, name: "Revati", sanskrit: "रेवती", star: "Zeta Piscium",
    range: [346.667, 360], lord: "Mercury", deity: "Pushan (Nourishing God)",
    symbol: "Fish or drum", nature: "deva", quality: "soft", element: "water",
    interpretation: "Revati is the final nakshatra — the nourisher and protector. Natives are gentle, wealthy, and spiritually complete. They nourish all beings. Travel over water is common. May seem dreamy but have deep wisdom. The journey of all 27 nakshatras is complete here.",
    career: "Animal welfare, film/entertainment, charity, water-related work, spiritual service, healing.",
    relationships: "Nourishing partner. Gentle and caring love. May be overly protective. Water connections in romance. Spiritual partnership.",
    keywords: ["revati", "nourishing", "gentle", "wealthy", "spiritual completion", "fish", "pushan"],
  },
];

/** Get nakshatra info by number (1-27) */
export function getNakshatraInfo(number: number): NakshatraInfo | undefined {
  return NAKSHATRA_DATA.find(n => n.number === number);
}

/** Get nakshatra info by name */
export function getNakshatraByName(name: string): NakshatraInfo | undefined {
  return NAKSHATRA_DATA.find(n => n.name.toLowerCase() === name.toLowerCase());
}
