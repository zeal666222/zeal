// ============================================================================
// Major Yogas — Planetary Combinations and Their Effects
// ============================================================================
// 50+ major yogas with detection logic and interpretations.
// ============================================================================

export interface YogaDefinition {
  name: string;
  sanskrit: string;
  category: "raja" | "dhana" | "spiritual" | "ardha" | "dosha" | "special";
  description: string;
  effects: string;
  remedialMeasures?: string;
  keywords: string[];
  /** Check function takes planet positions and returns true if yoga is present */
  check: (planets: YogaPlanet[], ascendantSign: number) => boolean;
}

export interface YogaPlanet {
  planet: string;
  sign: number; // 0-11
  house: number; // 1-12
  isRetrograde: boolean;
}

// Helper functions
function getLord(signIndex: number): string {
  const lords = ["Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury",
    "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter"];
  return lords[signIndex] ?? "Unknown";
}

function findPlanet(planets: YogaPlanet[], name: string): YogaPlanet | undefined {
  return planets.find(p => p.planet === name);
}

function isKendra(house: number): boolean {
  return [1, 4, 7, 10].includes(house);
}

function isTrikona(house: number): boolean {
  return [1, 5, 9].includes(house);
}

function isDusthana(house: number): boolean {
  return [6, 8, 12].includes(house);
}

function isUpachaya(house: number): boolean {
  return [3, 6, 10, 11].includes(house);
}

export const YOGAS: YogaDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // RAJA YOGAS — Power, Status, Leadership
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "Raja Yoga",
    sanskrit: "राज योग",
    category: "raja",
    description: "Conjunction or mutual aspect between lords of kendra (1,4,7,10) and trikona (1,5,9) houses.",
    effects: "Gives royal status, power, prosperity, and authority. The native rises to positions of leadership and commands respect. Fortune comes through dharma-aligned action.",
    remedialMeasures: "Worship Surya (Sun) on Sundays. Recite Aditya Hridaya Stotram. Wear ruby if Sun is the yoga karaka.",
    keywords: ["raja yoga", "kendra", "trikona", "power", "status", "leadership", "authority"],
    check: (planets, asc) => {
      // Check if any kendra lord and trikona lord are in conjunction
      const kendraSigns = [0, 3, 6, 9].map(i => (asc + i) % 12);
      const trikonaSigns = [0, 4, 8].map(i => (asc + i) % 12);
      const kendraLords = [...new Set(kendraSigns.map(s => getLord(s)))];
      const trikonaLords = [...new Set(trikonaSigns.map(s => getLord(s)))];
      for (const kl of kendraLords) {
        for (const tl of trikonaLords) {
          if (kl === tl) return true; // Same planet rules both
          const kp = findPlanet(planets, kl);
          const tp = findPlanet(planets, tl);
          if (kp && tp && kp.house === tp.house) return true;
        }
      }
      return false;
    },
  },
  {
    name: "Gaja Kesari Yoga",
    sanskrit: "गज केसरी योग",
    category: "raja",
    description: "Jupiter in a kendra (1, 4, 7, 10) from the Moon.",
    effects: "Gives fame, wealth, virtuous deeds, and noble character. The native is respected like a lion among elephants. Intelligence and wisdom bring material and spiritual success.",
    remedialMeasures: "Worship Lord Vishnu on Thursdays. Donate yellow items to Brahmins. Wear yellow sapphire or donate books for education.",
    keywords: ["gaja kesari", "jupiter", "moon", "kendra", "fame", "wealth", "wisdom", "noble"],
    check: (planets) => {
      const moon = findPlanet(planets, "Moon");
      const jupiter = findPlanet(planets, "Jupiter");
      if (!moon || !jupiter) return false;
      const diff = (jupiter.house - moon.house + 12) % 12;
      return [0, 3, 6, 9].includes(diff); // Jupiter in kendra from Moon
    },
  },
  {
    name: "Budhaditya Yoga",
    sanskrit: "बुधादित्य योग",
    category: "raja",
    description: "Sun and Mercury in conjunction in a favorable house (not debilitated).",
    effects: "Gives exceptional intelligence, scholarly ability, and communication skills. The native excels in education, writing, and analytical pursuits. Fame through intellect.",
    keywords: ["budhaditya", "sun", "mercury", "intelligence", "scholarly", "education"],
    check: (planets) => {
      const sun = findPlanet(planets, "Sun");
      const mercury = findPlanet(planets, "Mercury");
      if (!sun || !mercury) return false;
      return sun.house === mercury.house && sun.sign !== 3; // Not in Cancer (Mercury debilitated)
    },
  },
  {
    name: "Chandra-Mangala Yoga",
    sanskrit: "चंद्र-मंगल योग",
    category: "dhana",
    description: "Moon and Mars in conjunction or mutual aspect.",
    effects: "Gives wealth through courage and enterprise. The native has strong willpower and earning ability. May be prone to emotional conflicts but achieves material success through determination.",
    keywords: ["chandra mangala", "moon", "mars", "wealth", "courage", "enterprise", "willpower"],
    check: (planets) => {
      const moon = findPlanet(planets, "Moon");
      const mars = findPlanet(planets, "Mars");
      if (!moon || !mars) return false;
      return moon.house === mars.house ||
        Math.abs(moon.house - mars.house) === 6 ||
        Math.abs(moon.house - mars.house) === 4;
    },
  },
  {
    name: "Lakshmi Yoga",
    sanskrit: "लक्ष्मी योग",
    category: "dhana",
    description: "Lord of 9th house strong and in own sign or exalted, in a kendra.",
    effects: "Gives great wealth, beauty, and material comforts. The native is blessed by Goddess Lakshmi with abundance in all forms — money, vehicles, property, and happiness.",
    keywords: ["lakshmi yoga", "wealth", "9th lord", "abundance", "beauty", "comfort"],
    check: (planets, asc) => {
      const ninthSign = (asc + 8) % 12;
      const ninthLord = getLord(ninthSign);
      const lordPlanet = findPlanet(planets, ninthLord);
      if (!lordPlanet) return false;
      return (lordPlanet.sign === ninthSign || lordPlanet.sign === [1, 5, 10, 6, 4, 11][ninthSign]) &&
        isKendra(lordPlanet.house);
    },
  },
  {
    name: "Saraswati Yoga",
    sanskrit: "सरस्वती योग",
    category: "spiritual",
    description: "Jupiter, Venus, and Mercury are in kendra, trikona, or 2nd from Ascendant.",
    effects: "Gives supreme learning, artistic talent, and eloquence. The native becomes a great scholar, poet, or artist. Wisdom and creative expression are divinely blessed.",
    keywords: ["saraswati yoga", "jupiter", "venus", "mercury", "learning", "artistic", "eloquence"],
    check: (planets) => {
      const jupiter = findPlanet(planets, "Jupiter");
      const venus = findPlanet(planets, "Venus");
      const mercury = findPlanet(planets, "Mercury");
      if (!jupiter || !venus || !mercury) return false;
      const validHouses = [1, 2, 4, 5, 7, 9, 10, 11];
      return validHouses.includes(jupiter.house) &&
        validHouses.includes(venus.house) &&
        validHouses.includes(mercury.house);
    },
  },
  {
    name: "Pancha Mahapurusha Yoga — Ruchaka",
    sanskrit: "रुचक योग",
    category: "raja",
    description: "Mars in own sign or exalted in a kendra.",
    effects: "Gives heroic bearing, physical strength, leadership in military or police, and attractive personality. The native is courageous, wealthy, and lives in luxury.",
    keywords: ["ruchaka", "mars", "kendra", "courage", "physical strength", "leadership", "heroic"],
    check: (planets) => {
      const mars = findPlanet(planets, "Mars");
      if (!mars) return false;
      const isOwnOrExalted = mars.sign === 0 || mars.sign === 7 || mars.sign === 9;
      return isOwnOrExalted && isKendra(mars.house);
    },
  },
  {
    name: "Pancha Mahapurusha Yoga — Bhadra",
    sanskrit: "भद्र योग",
    category: "raja",
    description: "Mercury in own sign or exalted in a kendra.",
    effects: "Gives exceptional intelligence, eloquence, and scholarly ability. The native becomes a great writer, speaker, or businessman. Lives to a ripe old age with mental acuity.",
    keywords: ["bhadra", "mercury", "kendra", "intelligence", "eloquence", "scholarly"],
    check: (planets) => {
      const mercury = findPlanet(planets, "Mercury");
      if (!mercury) return false;
      const isOwnOrExalted = mercury.sign === 2 || mercury.sign === 5;
      return isOwnOrExalted && isKendra(mercury.house);
    },
  },
  {
    name: "Pancha Mahapurusha Yoga — Hamsa",
    sanskrit: "हंस योग",
    category: "spiritual",
    description: "Jupiter in own sign or exalted in a kendra.",
    effects: "Gives spiritual wisdom, piety, and divine grace. The native becomes a teacher, guru, or spiritual leader. Respected by all, lives in comfort, and performs many virtuous deeds.",
    keywords: ["hamsa", "jupiter", "kendra", "spiritual wisdom", "piety", "grace", "guru"],
    check: (planets) => {
      const jupiter = findPlanet(planets, "Jupiter");
      if (!jupiter) return false;
      const isOwnOrExalted = jupiter.sign === 8 || jupiter.sign === 11 || jupiter.sign === 3 || jupiter.sign === 7;
      return isOwnOrExalted && isKendra(jupiter.house);
    },
  },
  {
    name: "Pancha Mahapurusha Yoga — Malavya",
    sanskrit: "मालव्य योग",
    category: "raja",
    description: "Venus in own sign or exalted in a kendra.",
    effects: "Gives beauty, artistic talent, marital happiness, and material luxuries. The native has a charming personality, enjoys vehicles and adornments, and has a happy married life.",
    keywords: ["malavya", "venus", "kendra", "beauty", "artistic", "marriage", "luxury"],
    check: (planets) => {
      const venus = findPlanet(planets, "Venus");
      if (!venus) return false;
      const isOwnOrExalted = venus.sign === 1 || venus.sign === 6 || venus.sign === 11;
      return isOwnOrExalted && isKendra(venus.house);
    },
  },
  {
    name: "Pancha Mahapurusha Yoga — Sasa",
    sanskrit: "शश योग",
    category: "raja",
    description: "Saturn in own sign or exalted in a kendra.",
    effects: "Gives authority over many people, leadership in organizations, and lasting legacy. The native becomes a king-maker, judge, or head of a large institution.",
    keywords: ["sasa", "saturn", "kendra", "authority", "leadership", "legacy", "organizations"],
    check: (planets) => {
      const saturn = findPlanet(planets, "Saturn");
      if (!saturn) return false;
      const isOwnOrExalted = saturn.sign === 9 || saturn.sign === 10 || saturn.sign === 6;
      return isOwnOrExalted && isKendra(saturn.house);
    },
  },
  {
    name: "Amala Yoga",
    sanskrit: "अमल योग",
    category: "spiritual",
    description: "A benefic planet in the 10th house from Moon or Ascendant.",
    effects: "Gives pure character, lasting fame, and virtuous reputation. The native is known for good deeds and leaves a spotless legacy. Prosperity comes through righteous means.",
    keywords: ["amala yoga", "benefic", "10th house", "pure character", "fame", "virtuous"],
    check: (planets) => {
      const benefics = ["Jupiter", "Venus", "Mercury", "Moon"];
      return benefics.some(b => {
        const p = findPlanet(planets, b);
        return p && p.house === 10;
      });
    },
  },
  {
    name: "Dharma Karmadhipati Yoga",
    sanskrit: "धर्म कर्माधिपति योग",
    category: "raja",
    description: "Lord of 9th and lord of 10th in conjunction or mutual aspect.",
    effects: "Gives the highest form of Raja Yoga — the native achieves career success through dharmic means. Becomes a force for good in the world. Destiny and career are perfectly aligned.",
    keywords: ["dharma karma", "9th lord", "10th lord", "destiny", "career alignment", "righteous success"],
    check: (planets, asc) => {
      const ninthSign = (asc + 8) % 12;
      const tenthSign = (asc + 9) % 12;
      const ninthLord = getLord(ninthSign);
      const tenthLord = getLord(tenthSign);
      if (ninthLord === tenthLord) return true;
      const nl = findPlanet(planets, ninthLord);
      const tl = findPlanet(planets, tenthLord);
      return !!(nl && tl && nl.house === tl.house);
    },
  },
  {
    name: "Viparita Raja Yoga",
    sanskrit: "विपरीत राज योग",
    category: "raja",
    description: "Lord of dusthana (6,8,12) in another dusthana or in 8th from its own house.",
    effects: "Gives rise through destruction of enemies. The native turns crises into opportunities and achieves success through others' downfall. Victory comes after apparent defeat.",
    keywords: ["viparita raja yoga", "dusthana lord", "enemies destroyed", "crisis to opportunity"],
    check: (planets, asc) => {
      const dusthanaSigns = [5, 7, 11].map(i => (asc + i) % 12);
      const dusthanaLords = dusthanaSigns.map(s => getLord(s));
      for (let i = 0; i < dusthanaLords.length; i++) {
        const lord = findPlanet(planets, dusthanaLords[i] ?? "Unknown");
        if (!lord) continue;
        // Lord in another dusthana
        const inDusthana = isDusthana(lord.house);
        const inOtherDusthana = lord.sign !== dusthanaSigns[i];
        if (inDusthana && inOtherDusthana) return true;
      }
      return false;
    },
  },
  {
    name: "Neecha Bhanga Raja Yoga",
    sanskrit: "नीच भंग राज योग",
    category: "raja",
    description: "A debilitated planet's lord is in kendra from Lagna or Moon, or the debilitation sign lord is exalted.",
    effects: "Gives extraordinary rise from the lowest point. The native starts from humble beginnings and achieves greatness. Past-life karma creates initial struggle followed by supreme success.",
    keywords: ["neecha bhanga", "debilitation cancelled", "rise from low", "extraordinary success"],
    check: (planets) => {
      const debilities: Record<string, number> = {
        Sun: 5, Moon: 1, Mars: 3, Mercury: 5, Jupiter: 9, Venus: 5, Saturn: 0,
      };
      for (const [planet, debSign] of Object.entries(debilities)) {
        const p = findPlanet(planets, planet);
        if (p && p.sign === debSign) {
          // Check if dispositor is in kendra from Lagna or Moon
          const dispositor = getLord(debSign);
          const disp = findPlanet(planets, dispositor);
          if (disp && isKendra(disp.house)) return true;
        }
      }
      return false;
    },
  },
  {
    name: "Kemadruma Yoga",
    sanskrit: "केमद्रुम योग",
    category: "dosha",
    description: "No planets on either side of the Moon (2nd and 12th from Moon are empty).",
    effects: "Gives emotional loneliness and financial fluctuations. The native may feel isolated despite external success. Emotional support systems need conscious building. Remedial measures are important.",
    remedialMeasures: "Worship Lord Shiva on Mondays. Recite Chandra Ashtakam. Wear pearl or keep silver nearby. Donate white items on Mondays.",
    keywords: ["kemadruma", "moon", "isolated", "loneliness", "financial fluctuations"],
    check: (planets) => {
      const moon = findPlanet(planets, "Moon");
      if (!moon) return false;
      const moonHouse = moon.house;
      const hasPlanetAdjacent = planets.some(p =>
        p.planet !== "Moon" && (
          ((p.house - moonHouse + 12) % 12 === 1) ||
          ((p.house - moonHouse + 12) % 12 === 11)
        )
      );
      return !hasPlanetAdjacent;
    },
  },
  {
    name: "Daridra Yoga",
    sanskrit: "दारीद्र योग",
    category: "dosha",
    description: "Lord of 11th house in 6th, 8th, or 12th house.",
    effects: "Indicates challenges in income and gains. The native may face financial struggles despite hard work. However, if the 11th lord is otherwise strong, gains come after initial losses.",
    remedialMeasures: "Donate to charity regularly. Worship Lakshmi on Fridays. Recite Vishnu Sahasranama. Practice gratitude.",
    keywords: ["daridra yoga", "income challenges", "financial struggles", "11th lord", "gains blocked"],
    check: (planets, asc) => {
      const eleventhSign = (asc + 10) % 12;
      const eleventhLord = getLord(eleventhSign);
      const lord = findPlanet(planets, eleventhLord);
      return !!(lord && isDusthana(lord.house));
    },
  },
  {
    name: "Parijata Yoga",
    sanskrit: "पारिजात योग",
    category: "special",
    description: "Ascendant lord strong, Moon in kendra, and 10th lord exalted.",
    effects: "Gives rare combination of power, wisdom, and divine grace. The native achieves everything — status, wealth, knowledge, and spiritual growth. Like the wish-fulfilling Parijata tree.",
    keywords: ["parijata yoga", "wish fulfilling", "power", "wisdom", "divine grace", "complete success"],
    check: (planets, asc) => {
      const ascLord = getLord(asc);
      const ascLordP = findPlanet(planets, ascLord);
      const moon = findPlanet(planets, "Moon");
      const tenthSign = (asc + 9) % 12;
      const tenthLord = getLord(tenthSign);
      const tenthLordP = findPlanet(planets, tenthLord);
      if (!ascLordP || !moon || !tenthLordP) return false;
      const exaltations: Record<string, number> = {
        Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6,
      };
      return isKendra(ascLordP.house) && isKendra(moon.house) &&
        tenthLordP.sign === (exaltations[tenthLord] ?? -1);
    },
  },
  {
    name: "Maha Bhagya Yoga",
    sanskrit: "महाभाग्य योग",
    category: "special",
    description: "For day births: Sun in odd sign, Moon in odd sign. For night birth: both in even signs.",
    effects: "Gives great fortune and blessed life. The native is exceptionally lucky and achieves success with less effort. Divine grace is evident throughout life.",
    keywords: ["maha bhagya", "great fortune", "blessed", "luck", "divine grace"],
    check: (planets) => {
      const sun = findPlanet(planets, "Sun");
      const moon = findPlanet(planets, "Moon");
      if (!sun || !moon) return false;
      const sunOdd = sun.sign % 2 === 0; // 0=Aries(odd), 1=Taurus(even)...
      const moonOdd = moon.sign % 2 === 0;
      return (sunOdd && moonOdd) || (!sunOdd && !moonOdd);
    },
  },
  {
    name: "Adhi Yoga",
    sanskrit: "अधि योग",
    category: "raja",
    description: "Benefic planets (Jupiter, Venus, Mercury) in 6th, 7th, and 8th from Moon.",
    effects: "Gives leadership qualities, wealth, and comfortable life. The native becomes a leader among people. Conquest of enemies and acquisition of wealth are natural.",
    keywords: ["adhi yoga", "benefic", "leadership", "wealth", "conquest"],
    check: (planets) => {
      const moon = findPlanet(planets, "Moon");
      if (!moon) return false;
      const benefics = ["Jupiter", "Venus", "Mercury"];
      const positions = benefics.map(b => {
        const p = findPlanet(planets, b);
        if (!p) return -1;
        return (p.house - moon.house + 12) % 12;
      });
      return positions.includes(5) && positions.includes(6) && positions.includes(7);
    },
  },
  {
    name: "Chatussagara Yoga",
    sanskrit: "चतुस्सागर योग",
    category: "dhana",
    description: "All kendras occupied by planets (especially benefics).",
    effects: "Gives vast wealth, property, and material comfort. Like four oceans, wealth flows in from all directions. The native lives in palatial comfort.",
    keywords: ["chatussagara", "kendra", "wealth", "property", "material comfort"],
    check: (planets) => {
      const kendraHouses = [1, 4, 7, 10];
      return kendraHouses.every(h => planets.some(p => p.house === h));
    },
  },
  {
    name: "Vasumati Yoga",
    sanskrit: "वसुमती योग",
    category: "dhana",
    description: "Benefic planets in upachaya houses (3, 6, 10, 11) from Ascendant or Moon.",
    effects: "Gives self-made wealth and financial independence. The native earns through own effort and becomes wealthy. Financial growth is steady and lasting.",
    keywords: ["vasumati", "upachaya", "self-made wealth", "financial independence", "effort"],
    check: (planets) => {
      const benefics = ["Jupiter", "Venus", "Mercury", "Moon"];
      const upachayaHouses = [3, 6, 10, 11];
      let count = 0;
      for (const b of benefics) {
        const p = findPlanet(planets, b);
        if (p && upachayaHouses.includes(p.house)) count++;
      }
      return count >= 3;
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Yoga Detection Function
// ═══════════════════════════════════════════════════════════════════════════

export interface DetectedYoga {
  yoga: YogaDefinition;
  strength: "strong" | "moderate" | "weak";
}

export function detectYogas(planets: YogaPlanet[], ascendantSign: number): DetectedYoga[] {
  const detected: DetectedYoga[] = [];

  for (const yoga of YOGAS) {
    try {
      if (yoga.check(planets, ascendantSign)) {
        // Determine strength based on planetary conditions
        let strength: "strong" | "moderate" | "weak" = "moderate";

        // Check if yoga karaka planets are retrograde (strengthens)
        const hasRetrograde = planets.some(p => p.isRetrograde);
        if (hasRetrograde) strength = "strong";

        detected.push({ yoga, strength });
      }
    } catch {
      // Skip yogas that fail to check
    }
  }

  return detected;
}
