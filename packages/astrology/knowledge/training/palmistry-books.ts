import type { TrainingChunk } from "./index";

export const PALMISTRY_BOOKS: TrainingChunk[] = [
  {
    id: "palm-001",
    domain: "palmistry",
    category: "hasta-samudrika",
    title: "Hasta Samudrika Shastra — Foundations",
    content:
      "Classical Indian palmistry treats the hand as a live map of karma and prakriti. Samudrika reading judges the whole hand — shape, colour, texture, flexibility — before any line is read; rachana (structure) reveals sanchita karma, lines reveal kriyamana. The active hand (right for right-handed seekers) shows what is being made of the inheritance; the passive hand shows what was brought in. Never read one hand alone. Skin texture (fine silk to coarse), finger flexibility (bent-back shows adaptability), and thumb set (angle of approach shows generosity vs self-containment) come before every line.",
    keywords: ["hasta samudrika", "palmistry", "palm reading", "samudrika shastra", "active passive hand", "karma hand", "hand texture", "palmistry basics", "hasta rekha"],
    source: "Hasta Samudrika Shastra — Rangacharya",
  },
  {
    id: "palm-002",
    domain: "palmistry",
    category: "major-lines",
    title: "The Four Major Lines — Order of Reading",
    content:
      "Read in order: Life, Head, Heart, Fate. The life line (jivan rekha) arcs around the thumb mount — vitality, stamina, life-force quality, never lifespan. The head line (mastishka rekha) crosses the palm centre — thinking style: sloped = imaginative, straight = practical, forked = versatile writer. The heart line (hriday rekha) runs under the fingers — emotional style: curving up to Jupiter = idealistic devotion, ending between Jupiter and Saturn = balanced affection, ending under Saturn = guarded, possessive. The fate line (bhagya rekha) rises from the base — career and life-direction, and its absence is not doom: some lives are self-directed rather than fated.",
    keywords: ["life line", "jivan rekha", "head line", "mastishka", "heart line", "hriday rekha", "fate line", "bhagya rekha", "major lines", "palm lines", "career line"],
    source: "The Laws of Scientific Hand Reading — William Benham",
  },
  {
    id: "palm-003",
    domain: "palmistry",
    category: "major-lines",
    title: "Life Line — Vitality, not Lifespan",
    content:
      "The single most misread line in palmistry. The life line measures quality of vitality, strength of constitution, and enthusiasm for living — never the length of life. A wide arc (sweeping out to the centre of the palm) = abundant energy, boldness. A tight arc hugging the thumb = cautious, reserved energy that is spent carefully. Breaks are examined for overlapping repair lines (a square covering a break = protection through transition). A sister line running inside the life line = a guardian influence, recovery strength. Chain-like beginnings = sensitive childhood. Always cross-check with the Venus mount: a full Venus with a fine life line outranks a grand line on a flat mount.",
    keywords: ["life line", "jivan rekha", "vitality", "lifespan myth", "sister line", "guardian line", "life line break", "venus mount", "energy", "stamina"],
    source: "Cheiro's Language of the Hand — Cheiro",
  },
  {
    id: "palm-004",
    domain: "palmistry",
    category: "major-lines",
    title: "Head and Heart Line Interplay — The Mind-Heart Balance",
    content:
      "The gap where the head and heart lines begin tells the core temperament. Lines joined at the start = cautious, deliberate, sometimes overthinking every feeling before acting — decisions are slow but durable. Lines apart = impulsive, spontaneous, acts first and analyses later. Head line touching the Mount of Moon = imagination in service of logic. Heart line chained = emotionally sensitive, absorbs others' moods. Heart line with fine branches rising = warm generosity; branches drooping = disappointment held onto. When the head line slopes deep into Luna and the heart is chained, the reading must address emotional overwhelm as a theme — the seeker feels first and thinks second.",
    keywords: ["head line", "heart line", "mind heart balance", "temperament", "impulsive", "cautious", "sensitivity", "chained heart line", "luna", "emotional reading"],
    source: "The Laws of Scientific Hand Reading — William Benham",
  },
  {
    id: "palm-005",
    domain: "palmistry",
    category: "fate-career",
    title: "Fate Line — Career Direction and Its Absence",
    content:
      "Bhagya rekha rises from the base of the palm toward Saturn. Starting from the life line = career chosen by family influence or self-made from early duty. Starting from Luna = career in public-facing or imaginative fields, shaped by others' goodwill. Starting from Venus = love of people and beauty drives the work. A fate line that stops mid-palm and restarts = a deliberate career change, often the strongest reading of reinvention. An island on the fate line = a period of dissatisfaction in work. A double fate line = two parallel callings, or work plus vocation. No visible fate line = a life written by choice, not script — frame it as freedom, never as lack of destiny.",
    keywords: ["fate line", "bhagya rekha", "career", "job", "business", "destiny", "career change", "double fate line", "saturn line", "vocation", "self made"],
    source: "Indian Palmistry — J.B. Dale",
  },
  {
    id: "palm-006",
    domain: "palmistry",
    category: "mounts",
    title: "The Seven Mounts — Where Character Lives",
    content:
      "Mounts are the fleshy pads; a developed mount adds its planet's gift, an over-full one its excess. Jupiter (under index) = ambition, leadership; overdeveloped = pride, domination. Saturn (under middle) = discipline, depth, solitude; excess = melancholy. Apollo (under ring) = art, charm, love of beauty; excess = vanity. Mercury (under little finger) = wit, commerce, healing hands; excess = restlessness. Venus (thumb base) = love, warmth, vitality. Luna (opposite Venus, outer palm) = imagination, intuition, travel-longing. Mars positive (under Jupiter) = courage to act; Mars negative (above Luna) = endurance, resistance. Read mounts first, lines second — lines confirm what mounts promise.",
    keywords: ["mounts", "mount of jupiter", "mount of saturn", "mount of apollo", "mount of mercury", "mount of venus", "mount of luna", "mount of mars", "palm mounts", "character"],
    source: "Cheiro's Language of the Hand — Cheiro",
  },
  {
    id: "palm-007",
    domain: "palmistry",
    category: "relationships",
    title: "Marriage and Children Lines — Reading with Responsibility",
    content:
      "Fine horizontal lines on the palm's edge below the little finger (Mercury) are marriage/attachment lines. Deep and long = a defining bond; forked at the start = courtship hesitation, forked at the end = drifting apart that can be repaired by naming it. Lines touching but parallel = a significant relationship that stayed unofficial. Children lines (vertical strokes rising from a marriage line) are read as potential and meaning, never a headcount promise — frame as 'capacity for nurture'. Never announce timelines or numbers as certainty. When a seeker asks 'will we stay together', read the combination: heart line style, marriage line quality, and Venus mount warmth — and give agency, not verdict.",
    keywords: ["marriage lines", "children lines", "attachment lines", "relationship palmistry", "love line", "mercury", "divorce sign", "compatibility", "shaadi", "vivah"],
    source: "Cheiro's Language of the Hand — Cheiro",
  },
  {
    id: "palm-008",
    domain: "palmistry",
    category: "hand-shapes",
    title: "Hand Shapes — The Four Elemental Types",
    content:
      "Square palm + short fingers = Earth hand: practical, reliable, hands-on, needs tangible results. Square or rectangular palm + long fingers = Air hand: mental, communicative, lives in ideas, needs novelty. Long palm + short fingers = Fire hand: energetic, impatient, natural initiator, burns bright and fast. Long palm + long fingers = Water hand: sensitive, intuitive, artistic, absorbs atmosphere. Element first, then thumb: a firm-set thumb = determination held; a flexible thumb bending back = generosity and adaptability, sometimes overspending of self. Long lower thumb phalange (logic) with a short nail phalange (will) = brilliant planner who must guard against not finishing.",
    keywords: ["hand shapes", "earth hand", "air hand", "fire hand", "water hand", "hand type", "thumb", "will phalange", "logic phalange", "finger length", "prakriti"],
    source: "The Laws of Scientific Hand Reading — William Benham",
  },
  {
    id: "palm-009",
    domain: "palmistry",
    category: "marks-signs",
    title: "Marks and Signs — Stars, Islands, Squares, Crosses",
    content:
      "Marks modulate the line they sit on. A star = sudden event or brilliance in that line's domain (a star on Apollo = fame or recognition). An island = a period of strain or lowered vitality inside the line's span — read as duration, not disaster. A square = protection: a square around a break in the life line = the transition is guarded, recovery assured. A cross = obstacle or, on Jupiter under a good fate line, a blessing of responsibility. A triangle = talent and intelligence applied. A chain = wavering energy through the span. Grilles and crosses on mounts = the mount's gift overactive into stress. Always read the mark with its line and mount together — a mark alone means little.",
    keywords: ["star", "island", "square", "cross", "triangle", "chain", "grille", "marks", "palm signs", "protection square", "repair line", "om"],
    source: "Indian Palmistry — J.B. Dale",
  },
  {
    id: "palm-010",
    domain: "palmistry",
    category: "minor-lines",
    title: "Minor Lines — Sun, Health, Travel, Girdle, Intuition",
    content:
      "The Sun line (Apollo) rises to the ring finger — recognition, art, charisma; a late-rising Sun line = recognition earned later, often the sweeter for it. The health line (Mercury) runs from the life line's base to the little finger — its absence with a clear hand is actually ideal in Benham's system; an islanded health line = a season to guard digestion and rest. Travel lines (horizontal marks on Luna's edge) = longing for movement and real journeys. The girdle of Venus (arcs above the heart line) = heightened sensitivity, aesthetic intensity, needs emotional regulation. The intuition line (arc from Luna to Mercury) = inner knowing as a working faculty — trust it, test it.",
    keywords: ["sun line", "apollo line", "health line", "mercury line", "travel lines", "girdle of venus", "intuition line", "minor lines", "recognition", "fame"],
    source: "The Laws of Scientific Hand Reading — William Benham",
  },
  {
    id: "palm-011",
    domain: "palmistry",
    category: "protocol-ethics",
    title: "Reading Protocol and Ethics — How a Professional Reads",
    content:
      "Order of a professional reading: (1) overall hand — texture, colour, consistency, flexibility; (2) thumb and finger settings; (3) mounts; (4) major lines; (5) minor lines; (6) marks. Announce nothing from a single feature; a verdict needs three corroborating signs. Absolute ethical lines: never predict death or a date of it, never diagnose disease from the hand (health lines describe tendency and season, then refer to a doctor), never read a palm as fate that removes choice — the hand shows weather, the sailor still steers. Photograph readings: request both hands, good light, no filters — filters erase texture, and texture is data. Close every reading with one concrete, doable step.",
    keywords: ["reading protocol", "palmistry ethics", "how to read palm", "death prediction", "medical disclaimer", "photo reading", "hand photo", "verdict", "three signs", "professional reading"],
    source: "The Laws of Scientific Hand Reading — William Benham",
  },
  {
    id: "palm-012",
    domain: "palmistry",
    category: "protocol-ethics",
    title: "Fingers and Phalanges — The Pillars of the Hand",
    content:
      "Jupiter finger = self-belief and command; a long Jupiter finger with a square tip = born teacher or manager. Saturn finger = responsibility and seriousness; a very long Saturn = the weight-carrier of the family. Apollo finger = creativity and appetite for appreciation. Mercury finger = communication, negotiation, healing touch — a long Mercury with a waisted tip = the counsellor's hand. Fingertips: pointed = idealism, square = practicality, spatulate = invention and action, conic = artistic ease. Knotty joints (philosophic hand) = analysis before acceptance; smooth joints = quick intuition. Fingers held wide apart = openness and independence; held tight = caution with money and heart alike.",
    keywords: ["fingers", "phalanges", "jupiter finger", "saturn finger", "apollo finger", "mercury finger", "fingertips", "pointed square spatulate", "knotty fingers", "smooth joints", "hand analysis"],
    source: "Cheiro's Language of the Hand — Cheiro",
  },
];
