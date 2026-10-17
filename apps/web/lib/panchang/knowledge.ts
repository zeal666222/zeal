// ============================================================================
// ZEAL — Panchang Knowledge Table (static Hinglish guidance copy)
// ----------------------------------------------------------------------------
// Pure data: one-line "is din kya karein / kin cheezon se bachein" guidance
// keyed by the engine's name tables. Traditional folk/practical guidance —
// advisory, never prescriptive (no medical/legal/financial directives).
// ============================================================================

/** Keyed by tithi base name (paksha-agnostic core theme). */
export const TITHI_GUIDANCE: Record<string, string> = {
  Pratipada: "Fine for new beginnings, short journeys and buying something new.",
  Dwitiya: "Good for household tasks, relationships and work that builds stability.",
  Tritiya: "Auspicious for study, food and building — the day to take the third step.",
  Chaturthi: "Best for removing obstacles — remember Ganesh; avoid taking new risks.",
  Panchami: "Great for study, documents and devotional work; don't overdo rest.",
  Shashthi: "Travel, play and social work; a day for energetic effort.",
  Saptami: "Work of forgiveness and peace; stay out of quarrels.",
  Ashtami: "Good for vows and sadhana; go slow with adversarial or claim-related work.",
  Navami: "Activity and momentum; avoid harshness in word and conduct.",
  Dashami: "Work of dharma, service and ethics; focus in matters of authority.",
  Ekadashi: "Fasting, listening and bodily cleansing; avoid heavy feasting.",
  Dwadashi: "Giving, completion and welcoming tasks; travel is favorable.",
  Trayodashi: "Worship, instruments and Milan work; never display cruelty.",
  Chaturdashi: "Fierce work or turning a crisis; stay calm and avoid hatred.",
  Purnima: "Vrat, morning worship, dakshina and giving — excellent.",
  Amavasya: "Tarpan, ancestral rites and peace; avoid new beginnings.",
};

/** Keyed by nakshatra name (27). */
export const NAKSHATRA_GUIDANCE: Record<string, string> = {
  Ashwini: "Work of speed and healing; good for starting travel or a health routine.",
  Bharani: "Work of bearing and holding — storage, finance; avoid fierce acts.",
  Krittika: "Sharp work (cutting, editing, instruments); keep your temper in check.",
  Rohini: "Creation and beauty — crafting, farming, building; steady work flourishes.",
  Mrigashira: "Search, study and conversation; short trips go well.",
  Ardra: "Breaking and cleansing work; avoid making new promises.",
  Punarvasu: "Return, renewal and trust work; hope of finding what was lost.",
  Pushya: "Nourishment and worship — the very best; wonderful for auspicious starts.",
  Ashlesha: "Hidden work, research and medicine; speak on matters of trust with care.",
  Magha: "Gathering, civic work and tradition; keep the ego away.",
  "Purva Phalguni": "Milan, celebration and rest; the arts move gracefully.",
  "Uttara Phalguni": "Giving, marriage and friendship work; favors and contracts stay firm.",
  Hasta: "Hustle and craft — workmanship, deals and skill work; reward comes through effort.",
  Chitra: "Art, design and analysis; work of beauty and planning.",
  Swati: "Wind and movement — business and outreach; don't strain with tension.",
  Vishakha: "The yoga of reaching the goal — effort will bear fruit; avoid rushing.",
  Anuradha: "Friendship and devotion; alliances and music go well.",
  Jyeshtha: "Responsibility and senior work; decisions about protection — shun arrogance.",
  Mula: "Uprooting, investigation and mining work; move house only after careful thought.",
  "Purva Ashadha": "A humble yet rightful claim; take the first step boldly.",
  "Uttara Ashadha": "A time of victory and stability — long-term and sacred work thrives.",
  Shravana: "Listening and learning — guidance, music and story; hear counsel well.",
  Dhanishta: "Wealth and abundance, material comfort; avoid gossip about your name.",
  Shatabhisha: "Medical and precision-science work goes well; at this time steer clear of crowds.",
  "Purva Bhadrapada": "Avoid fierce or violent acts; travel and giving go well. Keep anger in check.",
  "Uttara Bhadrapada": "Deep work — knowledge and advice; steady beginnings go well.",
  Revati: "Parayana (the final journey) and protection; giving and blessing work goes well.",
};

/** Keyed by yoga name (27). */
export const YOGA_GUIDANCE: Record<string, string> = {
  Vishkambha: "A day of obstruction — avoid new starts; stay auspicious through effort, service and giving.",
  Priti: "Work of belonging — relationships and Milan are auspicious.",
  Ayushman: "Health and seed-sowing work; home and residence stay steady.",
  Saubhagya: "Fortune rises — good work and vehicle or home matters go well.",
  Shobhana: "Grace and fame — worship, celebration and art are excellent.",
  Atiganda: "Be wary of danger and illness; avoid travel and never act in heat.",
  Sukarma: "Good deeds — teaching, service and harvest; everything is favorable.",
  Dhriti: "Steady courage; let ongoing work move at its own pace — the phase will change.",
  Shula: "The thorn yoga — avoid weapons and harm; soften it with remedies and charity.",
  Ganda: "A binding time — avoid new deals and keep your distance.",
  Vriddhi: "The yoga of growth — new fields, business and virtues increase.",
  Dhruva: "Fixed and steady — property, land and lasting investment; don't change course.",
  Vyaghata: "Destructive influence — avoid harsh words; remedies and giving bring good.",
  Harshana: "Ego and obstacles — tread carefully on important days; avoid new beginnings.",
  Vajra: "Vajra influence — hold off on firm undertakings; keep even fluid work small.",
  Siddhi: "The yoga of accomplishment — the best time to begin; work is signaling completion.",
  Vyatipata: "A crisis yoga — ritual, service and remedies; stay careful.",
  Variyan: "Auspicious water and nourishment work; irrigation and material gains.",
  Parigha: "Beware obstacles approaching — avoid fixed commitments; give and take remedies.",
  Shiva: "An auspicious Shiva yoga — worship, giving and meditation; good beginnings.",
  Siddha: "Success-loving — progress in spiritual and craft work.",
  Sadhya: "Fruitful work — gains in your profession; choose steady work, not petty tasks.",
  Shubha: "An auspicious day — Milan, clothing, vehicles; comfort grows.",
  Shukla: "Study, cleansing and giving go well; avoid fierce or forbidden acts.",
  Brahma: "A god-favored auspicious yoga — dharma, teaching and worship work; foundations set well.",
  Indra: "The throne yoga — strength in spirituality, ethics and governance.",
  Vaidhriti: "A reversed state — avoid new journeys and work; old work brings gains.",
};

/** Keyed by karana name (11). */
export const KARANA_GUIDANCE: Record<string, string> = {
  Bava: "Steady work; auspicious for clothing and vehicles.",
  Balava: "Auspicious tasks and material gain; short trips go well.",
  Kaulava: "Milan, relationships, land and food work is auspicious.",
  Taitila: "Work of affection and conduct; wisdom in remedies and means.",
  Garaja: "Farming and community welfare work; be careful with new starts.",
  Vanija: "Trade and profit — gains in bargaining; money work.",
  Vishti: "The inauspicious karana — avoid new work; take remedies.",
  Shakuni: "Gains in clever work; avoid gambling and overreach.",
  Chatushpada: "Work of animals and vehicles; keep your patience.",
  Naga: "Work of patience — be careful with loans and promises.",
  Kimstughna: "An auspicious karana — use it for study and service.",
};

/** Keyed by weekday english name (7). */
export const VARA_GUIDANCE: Record<string, string> = {
  Sunday: "Ravi's day — self-confidence and authority; a day to initiate.",
  Monday: "Som's day — keep the mind calm; travel for devotional work is auspicious.",
  Tuesday: "Mangal's day — energy and speed; pick up the work you left behind.",
  Wednesday: "Budh's day — excellent for study, conversation and business.",
  Thursday: "Guru's day — teaching, giving and honor; broadly auspicious.",
  Friday: "Shukra's day — art, beauty, relationships and joy.",
  Saturday: "Shani's day — the fruit of labor; discipline and service.",
};

/** Startup kaal/evil-kaal windows + auspicious windows. */
export interface WindowMeta {
  title: string;
  line: string;
}

export const WINDOW_GUIDANCE: {
  rahukaal: WindowMeta;
  yamagandam: WindowMeta;
  gulika: WindowMeta;
  abhijit: WindowMeta;
  brahma: WindowMeta;
} = {
  rahukaal: {
    title: "Rahu Kaal",
    line: "In Rahu Kaal, avoid new work, auspicious travel, signing or buying; finishing old work is fine.",
  },
  yamagandam: {
    title: "Yamagandam (Ambreyal)",
    line: "In Yamagandam, avoid vehicle and home work and hasty words; rest and peace serve you best.",
  },
  gulika: {
    title: "Gulika Kaal",
    line: "In Gulika, don't decide out of greed or hurry; don't impose restrictions on others.",
  },
  abhijit: {
    title: "Abhijit Muhurat",
    line: "The most auspicious window of midday — traditionally valid for good work except on Amavasya and Purnima.",
  },
  brahma: {
    title: "Brahma Muhurat",
    line: "The window about 1.5 hours before sunrise — best for bathing, prayer, meditation and study.",
  },
};
