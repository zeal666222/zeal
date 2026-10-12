// ============================================================================
// Dasha Interpretation Rules
// ============================================================================
// Vimshottari Dasha system — what happens during each planetary period.
// ============================================================================

export interface DashaInterpretation {
  planet: string;
  duration: number; // years
  general: string;
  career: string;
  relationships: string;
  health: string;
  spiritual: string;
  challenges: string;
  remedies: string;
  keywords: string[];
}

export const DASHA_INTERPRETATIONS: Record<string, DashaInterpretation> = {
  Sun: {
    planet: "Sun",
    duration: 6,
    general: "Period of leadership, self-expression, and paternal matters. The Sun Mahadasha brings themes of authority, career growth, and relationship with father figures into focus. Vitality and confidence are tested and built. Government connections and fame are highlighted.",
    career: "Career advances through leadership roles. Government jobs, politics, and administrative positions are favored. May bring conflicts with superiors if Sun is afflicted. Promotion and recognition are likely when Sun is well-placed.",
    relationships: "Relationship with father becomes prominent. May experience distance or conflict with authority figures. Marriage brings status if Sun is well-placed. Ego clashes with partner possible if afflicted.",
    health: "Heart, spine, and right eye need attention. Vitality generally increases but fire-related issues (fever, inflammation) may arise. Sun exposure and heart-healthy practices are important.",
    spiritual: "Soul purpose becomes clearer. Surya upasana (Sun worship) is powerful. Gayatri Mantra brings illumination. Connection to dharma deepens.",
    challenges: "Pride, ego conflicts, authoritarian tendencies, clashes with father or government. May feel overly responsible or carry the weight of the world.",
    remedies: "Offer water to Sun every morning (Surya Arghya). Recite Aditya Hridaya Stotram on Sundays. Wear ruby after consultation. Donate wheat, jaggery, and copper on Sundays.",
    keywords: ["sun dasha", "leadership", "authority", "father", "career", "government", "vitality", "confidence"],
  },
  Moon: {
    planet: "Moon",
    duration: 10,
    general: "Period of emotional growth, family matters, and public connection. The Moon Mahadasha brings focus on mind, emotions, mother, and the public sphere. Intuition develops. Travel and change of residence are common.",
    career: "Career in public-facing roles, food industry, real estate, water-related businesses, or counseling. May work from home or near water. Public recognition grows. Mother's influence on career.",
    relationships: "Mother relationship is central. Marriage and family life are emphasized. Emotional bonds deepen. May have strong attachment to homeland. Female figures play important roles.",
    health: "Emotional health is the key theme. Water balance, lungs, and mind need care. Mood fluctuations are common. Cooling practices and moon bathing help. Avoid excess salt and cold foods.",
    spiritual: "Emotional devotion (bhakti) deepens. Chandra worship on Mondays. Connection to feminine divine. Dreams carry important messages. Intuition is a spiritual gift.",
    challenges: "Emotional instability, mood swings, over-attachment to mother or home, water-related fears, public image concerns. May feel emotionally overwhelmed.",
    remedies: "Offer milk and white flowers to Shiva on Mondays. Recite Chandra Ashtakam. Wear pearl after consultation. Donate rice, milk, and silver on Mondays. Keep a bowl of water near the bed.",
    keywords: ["moon dasha", "emotions", "family", "mother", "public", "intuition", "mind", "travel"],
  },
  Mars: {
    planet: "Mars",
    duration: 7,
    general: "Period of courage, property, siblings, and energetic action. The Mars Mahadasha brings focus on land, courage, competition, and physical vitality. Conflicts may arise but also the strength to overcome them. Engineering, military, and surgical pursuits are favored.",
    career: "Career in military, police, engineering, surgery, sports, or real estate. Competitive fields bring success. May acquire land and property. Siblings play active role in career. Technical skills are honed.",
    relationships: "Sibling relationships are activated. Marriage may bring heat and passion but also conflicts. Mangal dosha effects manifest if present. Courage in relationships but need for patience.",
    health: "Accidents, cuts, burns, and surgery possible. Blood pressure and blood-related issues need monitoring. Physical exercise is essential but overexertion must be avoided. Bones and muscles need care.",
    spiritual: "Hanuman worship is powerful. Warrior spirituality. Energy is channeled through disciplined action (karma yoga). Anger management becomes a spiritual practice.",
    challenges: "Anger, impulsiveness, accidents, legal disputes, property conflicts, sibling disputes. May be overly aggressive or face aggressive opponents.",
    remedies: "Recite Hanuman Chalisa on Tuesdays. Visit Hanuman temple. Donate red lentils, red cloth, and land. Avoid non-vegetarian food on Tuesdays. Wear red coral after consultation.",
    keywords: ["mars dasha", "courage", "property", "siblings", "energy", "conflict", "land", "engineering"],
  },
  Mercury: {
    planet: "Mercury",
    duration: 17,
    general: "Period of intellect, education, business, and communication. The Mercury Mahadasha is the longest after Jupiter. Brings focus on learning, trade, writing, and analytical skills. Business ventures and education are highlighted.",
    career: "Career in business, trade, writing, journalism, accounting, IT, or education. Multiple income sources possible. Intellectual pursuits bring success. Younger siblings help in career. Communication skills are the primary asset.",
    relationships: "Communication is key in relationships. Intellectual compatibility matters most. Younger siblings and cousins are active. May live near educational institutions or markets. Business partnerships form.",
    health: "Nervous system, skin, and intestines need attention. Anxiety and overthinking are common. Intellectual work must be balanced with physical activity. Speech and hearing need care.",
    spiritual: "Study of scriptures (jnana yoga). Vishnu worship. Mantra japa is especially effective. Learning and teaching are spiritual practices. Green items in worship.",
    challenges: "Overthinking, nervous anxiety, speech problems, business losses from poor communication, deception in trade. May scatter energy across too many interests.",
    remedies: "Recite Vishnu Sahasranama on Wednesdays. Worship Lord Vishnu. Donate green moong dal, green cloth, and books. Wear emerald after consultation. Feed green food to cows.",
    keywords: ["mercury dasha", "intellect", "education", "business", "communication", "writing", "trade", "learning"],
  },
  Jupiter: {
    planet: "Jupiter",
    duration: 16,
    general: "Period of wisdom, fortune, children, and spiritual growth. The Jupiter Mahadasha is considered the most auspicious. Brings divine grace, expansion of knowledge, and growth in all areas. Teacher/guru figures appear. Fortune smiles.",
    career: "Career in teaching, law, religion, advisory roles, or finance. Fortune expands through dharma-aligned work. Children may start career. Government recognition. Wealth comes through wisdom and counsel.",
    relationships: "Marriage and children are blessed. Husband-wife relationship deepens spiritually. Guru-disciple relationships form. Elderly and wise people enter life. Family expands.",
    health: "Generally good health. Liver, thighs, and fat metabolism need attention. Weight gain possible. Healthy diet and moderate exercise maintain balance. Optimism supports healing.",
    spiritual: "Peak spiritual growth period. Jupiter is the karaka for dharma. Temple building, charity, and teaching are highly meritorious. Brahmin feeding and guru seva bring immense grace.",
    challenges: "Over-expansion, excessive optimism, dogmatism, weight gain, liver issues. May become preachy or overly attached to religious identity. Fortune can create complacency.",
    remedies: "Worship Lord Vishnu or Brihaspati on Thursdays. Donate yellow items, turmeric, and gold. Wear yellow sapphire after consultation. Respect and serve teachers and elders. Study sacred texts.",
    keywords: ["jupiter dasha", "wisdom", "fortune", "children", "spiritual growth", "teacher", "divine grace", "expansion"],
  },
  Venus: {
    planet: "Venus",
    duration: 20,
    general: "Period of luxury, marriage, arts, and material comfort. The Venus Mahadasha is the longest and often the most materially rewarding. Brings focus on relationships, beauty, vehicles, and sensual pleasures. Creative expression flourishes.",
    career: "Career in arts, entertainment, fashion, beauty, luxury goods, hospitality, or diplomacy. Material wealth increases. Marriage may bring business partnership. Vehicle comforts improve. Creative industries favor.",
    relationships: "Marriage and romantic relationships are central. If unmarried, marriage is highly likely. If married, relationship deepens or faces tests. Beauty and charm attract others. Social life flourishes.",
    health: "Reproductive system, kidneys, and throat need attention. Indulgence in sweets and luxuries may cause health issues. Balance pleasure with discipline. Skin care is important.",
    spiritual: "Shukra worship and Shiva-Parvati worship. Beauty as spiritual path. Art and music become meditation. Tantric practices if initiated. Generosity is spiritual currency.",
    challenges: "Over-indulgence, relationship drama, extravagance, kidney issues, loss of discrimination. May become too attached to comfort and pleasure. Scandal through relationships possible if afflicted.",
    remedies: "Worship Lord Shiva and Goddess Lakshmi on Fridays. Donate white items, perfume, and vehicles (charity). Wear diamond or white sapphire after consultation. Respect women. Keep home beautiful and clean.",
    keywords: ["venus dasha", "luxury", "marriage", "arts", "comfort", "beauty", "relationships", "material"],
  },
  Saturn: {
    planet: "Saturn",
    duration: 19,
    general: "Period of hard work, discipline, career peak, and karmic reckoning. The Saturn Mahadasha is the longest and most transformative. Brings focus on career, structure, and karmic lessons. What was built on false foundations crumbles; what was built on truth is strengthened permanently.",
    career: "Career reaches its peak or undergoes major restructuring. Government service, large organizations, and old institutions favor. Delayed but permanent success. May change career path. Retirement planning becomes important.",
    relationships: "Relationships are tested and purified. Lonely periods may occur but lead to inner strength. Marriage may face challenges but emerges stronger. Elderly people need attention. Few but loyal friends.",
    health: "Bones, knees, teeth, and chronic conditions need attention. Slow-down is necessary. Discipline in health routines pays off. Avoid excess cold and dry foods. Regular exercise is essential.",
    spiritual: "Peak karmic clearing period. Shani worship and Hanuman seva. Service to the disabled, elderly, and working class. Detachment (vairagya) naturally develops. Saturn is the great teacher.",
    challenges: "Delays, obstacles, loneliness, chronic health issues, career setbacks, relationship tests. Sade Sati effects if Saturn transits Moon. Feelings of isolation and heaviness. But all challenges build permanent strength.",
    remedies: "Light sesame oil lamp under Peepal tree on Saturdays. Recite Hanuman Chalisa daily. Donate black items, iron, and sesame oil. Serve the disabled and elderly. Wear blue sapphire only after thorough consultation.",
    keywords: ["saturn dasha", "hard work", "discipline", "career", "karma", "obstacles", "structure", "transformation"],
  },
  Rahu: {
    planet: "Rahu",
    duration: 18,
    general: "Period of unconventional growth, foreign connections, technology, and material ambition. The Rahu Mahadasha brings sudden changes, foreign travel or settlement, and obsession with material goals. Technology and media play key roles. Illusions must be seen through.",
    career: "Career in technology, media, foreign companies, aviation, or unconventional fields. Sudden rise is possible. Foreign connections bring opportunities. May work in research or investigative fields. Political connections through unconventional means.",
    relationships: "Unconventional relationships or foreign spouse. Marriage may be with someone from different culture. Social networks expand enormously. May have secret relationships if afflicted. Friendship with powerful people.",
    health: "Unusual or hard-to-diagnose ailments. Poison, toxins, and allergies need care. Mental health — anxiety, phobias, and addictions are risks. Avoid intoxicants. Feet and shins need attention.",
    spiritual: "Spiritual path is unconventional. May be drawn to foreign spiritual traditions. Tantra and occult practices. Must learn to see through illusion (maya). Service to outcasts and foreigners is meritorious.",
    challenges: "Illusions, addictions, scandals, foreign troubles, unusual diseases, paranoia, sudden falls from grace. May chase mirages. Need to distinguish between genuine ambition and obsessive desire.",
    remedies: "Donate to lepers and outcasts. Recite Durga Saptashati. Keep a piece of silver with you. Avoid intoxicants completely. Feed birds and stray animals. Visit Shiva temple with Ravana's offering.",
    keywords: ["rahu dasha", "unconventional", "foreign", "technology", "material ambition", "illusion", "sudden change", "media"],
  },
  Ketu: {
    planet: "Ketu",
    duration: 7,
    general: "Period of spiritual liberation, detachment, and past-life resolution. The Ketu Mahadasha brings focus on moksha, letting go, and inner transformation. What no longer serves is released. Mystical experiences increase. May feel disconnected from material world.",
    career: "Career may feel meaningless or undergo dissolution. Research, occult, healing, and spiritual professions favor. May retreat from public life. Past-life skills resurface. Sudden loss followed by spiritual gain.",
    relationships: "Detachment from relationships. May feel lonely even in company. Past-life karmic relationships resolve. Family may not understand native's spiritual calling. Dogs and pets bring comfort.",
    health: "Unusual, hard-to-diagnose conditions. Surgical procedures possible. Spiritual healing works better than material medicine. Abdominal issues. Past-life karma manifests as health patterns.",
    spiritual: "Peak spiritual liberation period. Ketu is the karaka for moksha. Meditation, yoga, and ascetic practices are natural. May develop siddhis (spiritual powers). Past-life memories may surface. Guru appears unexpectedly.",
    challenges: "Detachment that feels like depression, loss of material interests, confusion, isolation, unusual health issues. May abandon responsibilities. Need to balance spiritual growth with worldly duties.",
    remedies: "Worship Lord Ganesha. Recite Ketu mantra or Ganesha Ashtakam. Donate blankets and items to ascetics. Keep a dog as companion. Meditation and yoga are essential. Visit ancient temples.",
    keywords: ["ketu dasha", "liberation", "detachment", "spiritual", "past-life", "moksha", "mystical", "letting go"],
  },
};
