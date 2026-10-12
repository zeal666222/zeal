// ============================================================================
// Transit Interpretation Rules
// ============================================================================
// How planetary transits affect the natal chart.
// ============================================================================

export interface TransitInterpretation {
  planet: string;
  general: string;
  through_houses: Record<number, string>; // house number → interpretation
  keywords: string[];
}

export const TRANSIT_INTERPRETATIONS: Record<string, TransitInterpretation> = {
  Sun: {
    planet: "Sun",
    general: "The Sun transits each sign monthly (~30 days). It illuminates the house it passes through, bringing vitality and focus to that life area. The Sun's transit is most important for career, health, and authority matters.",
    through_houses: {
      1: "Sun transit through 1st house brings vitality, confidence, and recognition. Good time for health improvement and self-development. Authority figures notice you.",
      2: "Financial matters are highlighted. May receive income or face expenses. Family matters need attention. Speech is more authoritative.",
      3: "Communication and courage increase. Short travels are favored. Siblings need attention. Good time for writing and learning new skills.",
      4: "Home and domestic matters are in focus. Mother's health needs attention. Property deals possible. Emotional foundation is tested.",
      5: "Creativity and romance are highlighted. Children need attention. Speculation may bring gains or losses. Intelligence is sharpened.",
      6: "Health challenges may arise but also the energy to overcome them. Enemies become active. Daily work routine is intensified.",
      7: "Partnerships and marriage are highlighted. Business deals are favored. Public image is in focus. Legal matters may arise.",
      8: "Transformation and hidden matters come to light. Health needs extra care. Inheritance matters possible. Research is favored.",
      9: "Fortune, dharma, and higher learning are highlighted. Long-distance travel is favored. Guru and father need attention. Spiritual growth.",
      10: "Career and public status are peak. Authority and recognition increase. Government matters are favored. Professional achievement.",
      11: "Gains and social networks are highlighted. Income increases. Elder siblings help. Desires are fulfilled. Group activities bring benefit.",
      12: "Expenditure increases. Foreign connections are activated. Spiritual practices deepen. Sleep and health need attention. Letting go.",
    },
    keywords: ["sun transit", "vitality", "authority", "career", "health", "recognition"],
  },
  Moon: {
    planet: "Moon",
    general: "The Moon transits each sign in ~2.5 days. It triggers emotional responses and activates the house it passes through. Most important for daily mood, public events, and starting new activities. Muhurta (electional astrology) depends heavily on Moon transit.",
    through_houses: {
      1: "Emotional energy is high. Good time to start new ventures. Mood is positive. Self-care is important.",
      2: "Financial decisions feel urgent. Family emotions are activated. Good time for financial planning.",
      3: "Communication flows easily. Courage to speak up. Short trips favored. Sibling connection.",
      4: "Emotional focus on home and mother. Domestic harmony or disharmony. Property decisions.",
      5: "Creative emotions flow. Romance is in the air. Children need emotional attention.",
      6: "Emotional response to health and work. Service feels meaningful. Conflicts may trigger emotions.",
      7: "Emotional focus on partnerships. Marriage matters activated. Public interaction increases.",
      8: "Deep emotional processing. Transformation feelings. Intuition is heightened.",
      9: "Emotional inspiration and faith. Spiritual feelings are strong. Travel desires.",
      10: "Emotional investment in career. Public feelings are strong. Recognition feels good.",
      11: "Emotional satisfaction from friends and gains. Social emotions are positive.",
      12: "Emotional need for solitude. Spiritual feelings deepen. Expenditure worries.",
    },
    keywords: ["moon transit", "emotions", "mood", "daily", "public", "muhurta"],
  },
  Mars: {
    planet: "Mars",
    general: "Mars transits each sign in ~45 days. It brings energy, action, and conflict to the house it passes through. Important for land, courage, and competition matters. Avoid starting peaceful activities when Mars transits sensitive points.",
    through_houses: {
      1: "Energy and drive increase. Good for physical exercise. May be irritable. Courage to start new ventures.",
      2: "Financial aggression — spending or earning intensely. Family arguments possible. Speech becomes sharp.",
      3: "Courage peaks. Good time for competitive exams. Sibling conflicts or cooperation. Writing with passion.",
      4: "Domestic conflicts possible. Property disputes. Mother's health needs attention. Land deals activated.",
      5: "Creative energy is fierce. Romance is passionate. Children need discipline. Speculation is risky.",
      6: "Excellent for overcoming enemies and diseases. Competitive advantage. Legal battles favor you.",
      7: "Partnership conflicts. Marriage heat. Business competition. Legal disputes with partners.",
      8: "Accident risk increases. Surgical procedures favored. Inheritance disputes. Deep transformation.",
      9: "Spiritual warrior energy. Conflicts with guru or father. Long-distance travel with purpose.",
      10: "Career competition is fierce. Authority challenges. Professional battles bring growth.",
      11: "Fight for gains. Social competition. Elder siblings need help. Goals pursued aggressively.",
      12: "Hidden enemies active. Sleep disturbed. Foreign conflicts. Expenditure on health or litigation.",
    },
    keywords: ["mars transit", "energy", "action", "conflict", "courage", "competition"],
  },
  Mercury: {
    planet: "Mercury",
    general: "Mercury transits each sign in ~14-30 days (varies with retrograde). It activates intellect, communication, and business in the house it passes through. Important for education, trade, and signing contracts.",
    through_houses: {
      1: "Intellect is sharp. Communication skills peak. Good for learning and teaching. Travel for education.",
      2: "Financial intelligence increases. Business deals are favored. Speech is persuasive.",
      3: "Communication flows. Writing and publishing favored. Short travels for business. Sibling help.",
      4: "Intellectual focus on home. Property documents signed. Mother's advice is valuable.",
      5: "Intellectual creativity peaks. Education is favored. Children's education progresses.",
      6: "Analytical problem-solving. Health research. Service through intellect. Legal documents.",
      7: "Business negotiations. Partnership discussions. Marriage talks. Legal agreements.",
      8: "Research and investigation. Occult study. Insurance and inheritance matters.",
      9: "Higher learning. Publishing. Spiritual study. Long-distance education.",
      10: "Career through intellect. Business career advances. Professional communication.",
      11: "Gains through intellect. Social networks expand. Technology brings income.",
      12: "Study in isolation. Foreign education. Spiritual learning. Research in seclusion.",
    },
    keywords: ["mercury transit", "intellect", "communication", "business", "education", "trade"],
  },
  Jupiter: {
    planet: "Jupiter",
    general: "Jupiter transits each sign in ~1 year. It brings expansion, fortune, and grace to the house it passes through. One of the most important transits for prediction. Jupiter's aspect on a house is always beneficial.",
    through_houses: {
      1: "Year of personal expansion. Health improves. Wisdom grows. Recognition comes. Divine grace on personality.",
      2: "Financial expansion. Family growth. Speech becomes wiser. Wealth increases through dharma.",
      3: "Courage and wisdom grow. Writing and teaching bring fortune. Siblings benefit. Short pilgrimages.",
      4: "Home expands — may move to larger house. Mother's health improves. Property fortune. Emotional wisdom.",
      5: "Children's fortune grows. Creative projects succeed. Education advances. Romance brings joy.",
      6: "Enemies are defeated through wisdom. Health improves with proper guidance. Service is rewarded.",
      7: "Marriage is blessed. Business partnerships expand. Legal matters resolve favorably.",
      8: "Spiritual transformation deepens. Inheritance fortune. Occult knowledge increases. Longevity blessed.",
      9: "Supreme fortune year. Dharma aligns. Guru appears. Long-distance travel or foreign settlement.",
      10: "Career expansion. Professional recognition. Authority grows. Dharma-aligned career peak.",
      11: "Gains multiply. Social networks expand. Elder siblings benefit. All desires are fulfilled.",
      12: "Spiritual expansion. Foreign settlement. Charitable expenditure. Liberation draws closer.",
    },
    keywords: ["jupiter transit", "fortune", "expansion", "wisdom", "grace", "dharma"],
  },
  Venus: {
    planet: "Venus",
    general: "Venus transits each sign in ~25-30 days. It brings beauty, love, and luxury to the house it passes through. Important for marriage, arts, and material comforts. Muhurta for weddings depends on Venus transit.",
    through_houses: {
      1: "Charm and beauty increase. Romantic opportunities. Vehicle comforts. Personal happiness.",
      2: "Financial gains through arts or beauty. Family harmony. Luxurious food and speech.",
      3: "Artistic expression flows. Romantic short trips. Sibling harmony. Creative communication.",
      4: "Home becomes beautiful. Domestic happiness. Vehicle purchase possible. Mother is happy.",
      5: "Romance is in the air. Creative projects flourish. Children bring joy. Speculation gains.",
      6: "Health improves with good food and rest. Service through arts. Reconciliation with enemies.",
      7: "Marriage and partnership are blessed. Business through beauty and arts. Social life flourishes.",
      8: "Intimate relationships deepen. Inheritance through female relatives. Occult arts studied.",
      9: "Spiritual romance. Foreign connections through love. Higher learning in arts.",
      10: "Career in arts flourishes. Public charm. Recognition through beauty and creativity.",
      11: "Gains through arts and social connections. Desires fulfilled. Female friends help.",
      12: "Romantic foreign travel. Luxurious expenditure. Spiritual love. Bed comforts.",
    },
    keywords: ["venus transit", "love", "beauty", "marriage", "arts", "luxury"],
  },
  Saturn: {
    planet: "Saturn",
    general: "Saturn transits each sign in ~2.5 years. It brings discipline, tests, and karmic lessons to the house it passes through. The most important slow transit for prediction. Saturn's Sade Sati (7.5 year transit over natal Moon) is especially significant.",
    through_houses: {
      1: "Year of self-discipline and restructuring. Health needs attention. Career may shift. Personality is tested and strengthened. Solitude is valuable.",
      2: "Financial discipline required. Family responsibilities increase. Speech becomes serious. Savings are tested.",
      3: "Courage is tested. Siblings may need help. Communication becomes serious. Short travels are effortful.",
      4: "Domestic responsibilities increase. Mother's health needs attention. Property matters are delayed. Emotional discipline.",
      5: "Children need discipline. Creative blocks possible. Education is delayed but thorough. Romance is serious.",
      6: "Excellent for defeating enemies. Health discipline pays off. Service is demanding but rewarding.",
      7: "Marriage is tested and deepened. Business partnerships require patience. Legal delays.",
      8: "Major transformation period. Health challenges. Inheritance delays. Deep inner work required.",
      9: "Dharma is tested. Guru relationship needs work. Travel delays. Fortune comes after effort.",
      10: "Career peak through discipline. Authority is earned. Professional recognition after long effort.",
      11: "Gains come slowly but permanently. Social circle becomes selective. Elder siblings need help.",
      12: "Expenditure discipline needed. Foreign matters are delayed. Spiritual discipline deepens. Hospital stays possible.",
    },
    keywords: ["saturn transit", "discipline", "karma", "tests", "career", "structure", "sade sati"],
  },
  Rahu: {
    planet: "Rahu",
    general: "Rahu transits each sign in ~1.5 years. It brings obsession, foreign connections, and unconventional change to the house it passes through. Sudden events and technological disruptions are common.",
    through_houses: {
      1: "Identity transformation. Foreign connections change self-image. Technology obsession. Unconventional self-expression.",
      2: "Financial obsession. Unconventional income sources. Family changes. Speech becomes provocative.",
      3: "Communication through technology. Unconventional courage. Social media fame. Sibling changes.",
      4: "Domestic upheaval. Foreign residence possible. Mother's health concerns. Property speculation.",
      5: "Unconventional education. Romance with foreigner. Children's unconventional path. Speculation risks.",
      6: "Unconventional enemies. Hidden diseases. Service through technology. Legal complications.",
      7: "Unconventional partnerships. Foreign spouse. Business through technology. Relationship surprises.",
      8: "Occult awakening. Sudden transformations. Inheritance surprises. Research breakthroughs.",
      9: "Foreign spiritual path. Unconventional guru. Long-distance travel obsession. Religious experimentation.",
      10: "Unconventional career path. Technology career. Sudden fame or infamy. Foreign company.",
      11: "Gains through technology. Unconventional social networks. Humanitarian obsession.",
      12: "Foreign settlement. Unconventional spiritual path. Secret expenditure. Hospital or ashram.",
    },
    keywords: ["rahu transit", "unconventional", "foreign", "technology", "obsession", "sudden change"],
  },
  Ketu: {
    planet: "Ketu",
    general: "Ketu transits each sign in ~1.5 years. It brings detachment, spiritual growth, and past-life resolution to the house it passes through. What no longer serves is released.",
    through_houses: {
      1: "Identity dissolution and spiritual rebirth. Detachment from physical appearance. Past-life skills emerge.",
      2: "Detachment from wealth. Family patterns released. Speech becomes sparse. Past-life financial karma.",
      3: "Detachment from communication efforts. Sibling karma resolves. Courage comes from within.",
      4: "Detachment from home and mother. Property sold or released. Emotional independence.",
      5: "Detachment from creative output. Children's karma resolves. Past-life merit surfaces.",
      6: "Enemies dissolve. Past-life health karma resolves. Service becomes effortless.",
      7: "Detachment from partnerships. Past-life relationship karma resolves. Independence in relationships.",
      8: "Deep spiritual transformation. Occult mastery from past lives. Inheritance from past karma.",
      9: "Detachment from organized religion. Personal dharma emerges. Past-life guru connection.",
      10: "Detachment from career status. Past-life professional karma resolves. Service without attachment.",
      11: "Detachment from social networks. Past-life friendships resolve. Gains come effortlessly.",
      12: "Spiritual liberation accelerates. Foreign detachment. Past-life moksha efforts bear fruit.",
    },
    keywords: ["ketu transit", "detachment", "spiritual", "past-life", "liberation", "release"],
  },
};

// Sade Sati interpretation
export const SADE_SATI_INTERPRETATION = {
  description: "Sade Sati is the 7.5-year period when Saturn transits over the natal Moon, affecting the 12th, 1st, and 2nd houses from the Moon. It is the most significant Saturn transit.",
  phases: {
    rising: {
      name: "Rising Phase (12th from Moon)",
      duration: "~2.5 years",
      interpretation: "The first phase of Sade Sati. Expenses increase, sleep is disturbed, and mental restlessness grows. Foreign connections are activated. This is the mildest phase but sets the tone for the transformation ahead.",
    },
    peak: {
      name: "Peak Phase (Over Natal Moon)",
      duration: "~2.5 years",
      interpretation: "The most intense phase. Health, career, and emotional life are tested. The native's identity is stripped down to essentials. Those who do inner work emerge transformed. Career may face setbacks but the foundation that remains is unshakeable.",
    },
    setting: {
      name: "Setting Phase (2nd from Moon)",
      duration: "~2.5 years",
      interpretation: "The final phase. Financial recovery begins. Family life rebuilds. Speech becomes wiser. The lessons of Sade Sati are integrated. The native emerges with permanent strength and wisdom.",
    },
  },
  remedies: "Light sesame oil lamp under Peepal tree on Saturdays. Recite Hanuman Chalisa daily. Serve the working class and elderly. Donate black sesame, iron, and mustard oil on Saturdays. Maintain humility and patience.",
};
