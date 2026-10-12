// apps/web/lib/dream/knowledge.ts
// Comprehensive Jungian dream interpretation knowledge base

import type {
  DreamTheme, DreamArchetype, DreamEmotion,
} from "./types";

// ─── SYMBOL DICTIONARY ──────────────────────────────────────────────────────────

export interface SymbolEntry {
  keywords: string[];
  meaning: string;
  jungianLayer: string;
  themes: DreamTheme[];
  archetypes: DreamArchetype[];
  emotions: DreamEmotion[];
  sentiment: "positive" | "neutral" | "challenging" | "transformative";
}

export const SYMBOL_DICTIONARY: SymbolEntry[] = [
  // ── Water ──────────────────────────────────────────────────────────
  {
    keywords: ["water", "ocean", "sea", "river", "lake", "pool", "swim", "swimming", "drown", "drowning", "wave", "waves", "flood", "rain", "waterfall", "stream", "pond", "tide", "underwater", "submarine"],
    meaning: "Water represents the unconscious mind, emotions, and the flow of psychic energy. Calm water reflects inner peace; turbulent water signals emotional upheaval. Deep water connects to the collective unconscious — ancient patterns shared by all humanity.",
    jungianLayer: "The unconscious itself. Water is the medium of the psyche — where conscious awareness dissolves into deeper, archetypal currents. To dream of water is to dream of the soul's own substance.",
    themes: ["water", "supernatural"],
    archetypes: ["great_mother", "self"],
    emotions: ["awe", "fear", "peace"],
    sentiment: "transformative",
  },
  {
    keywords: ["clear water", "crystal water", "pure water", "spring water"],
    meaning: "Crystal-clear water signals emotional clarity and spiritual purification. Your unconscious is transparent to you — rare and precious self-knowledge is emerging.",
    jungianLayer: "The Self reflecting in its purest form. Jung saw clear water as the psyche's mirror — when undisturbed, it reveals the archetypal patterns beneath.",
    themes: ["water"],
    archetypes: ["self"],
    emotions: ["peace", "awe"],
    sentiment: "positive",
  },
  {
    keywords: ["muddy water", "dirty water", "murky water", "polluted water"],
    meaning: "Muddy water indicates emotional confusion or contaminated feelings. Something in your waking life is clouding your emotional judgment — unresolved feelings are stirring up the sediment of your psyche.",
    jungianLayer: "The shadow contaminating the emotional waters. Unprocessed complexes have risen from the depths, muddying the clear perception of your feelings.",
    themes: ["water"],
    archetypes: ["shadow"],
    emotions: ["confusion", "anxiety"],
    sentiment: "challenging",
  },

  // ── Falling ────────────────────────────────────────────────────────
  {
    keywords: ["falling", "fall", "fell", "drop", "dropping", "plummet", "plummeting", "cliff", "edge"],
    meaning: "Falling represents loss of control, anxiety about a situation, or fear of failure. It often appears during life transitions when old supports are removed. Paradoxically, falling dreams invite you to surrender — sometimes you must let go to discover you can fly.",
    jungianLayer: "The ego's terror of dissolution. Falling is the persona losing its grip on conscious control. The unconscious is inviting you to trust the deeper Self — the fall always ends before you hit the ground, because the psyche knows you are more than your ego.",
    themes: ["falling"],
    archetypes: ["hero", "shadow"],
    emotions: ["fear", "anxiety"],
    sentiment: "challenging",
  },

  // ── Flying ─────────────────────────────────────────────────────────
  {
    keywords: ["flying", "fly", "flight", "floating", "soar", "soaring", "levitate", "levitation", "hover", "hovering", "airborne"],
    meaning: "Flying symbolizes freedom, expanded consciousness, and transcendence of limitations. You are rising above problems that once seemed insurmountable. Flying dreams often follow breakthroughs — moments when you've outgrown an old way of being.",
    jungianLayer: "The Self's liberation from ego constraints. Flight is the ultimate symbol of psychic transcendence — consciousness unbound from the gravity of everyday concerns. Jung associated flight with the development of transcendent function.",
    themes: ["flying"],
    archetypes: ["self", "hero"],
    emotions: ["joy", "awe", "peace"],
    sentiment: "positive",
  },

  // ── Being Chased ───────────────────────────────────────────────────
  {
    keywords: ["chased", "chase", "chasing", "pursued", "pursuit", "pursuing", "running from", "hiding", "hide", "escaping", "escape", "monster", "monsters", "attacked", "attack", "threat"],
    meaning: "Being chased represents avoidance — something in your unconscious is demanding attention, and you're running from it. The pursuer is often a disowned part of yourself (your shadow). Turning to face the chaser transforms the dream entirely.",
    jungianLayer: "The shadow in active pursuit. What you flee in the dream is what you flee in waking life — an aspect of yourself you refuse to acknowledge. The chase ends only when you turn around, for the shadow seeks integration, not destruction.",
    themes: ["being_chased"],
    archetypes: ["shadow", "hero"],
    emotions: ["fear", "anxiety"],
    sentiment: "challenging",
  },

  // ── Teeth ──────────────────────────────────────────────────────────
  {
    keywords: ["teeth", "tooth", "tooth falling", "teeth falling", "losing teeth", "crumbling teeth", "broken teeth", "dental", "dentist", "crumble", "crumbling"],
    meaning: "Teeth dreams reflect concerns about appearance, communication, and personal power. Losing teeth signals anxiety about how others perceive you, fear of saying the wrong thing, or feeling powerless in a situation. Teeth are your smile's architecture — they represent how you present yourself to the world.",
    jungianLayer: "The persona cracking under pressure. Teeth are the visible skeleton — the structural facade of identity. Their loss represents the terror of persona dissolution, but also the liberation that follows when you stop performing and start being authentic.",
    themes: ["teeth"],
    archetypes: ["persona", "shadow"],
    emotions: ["anxiety", "fear", "confusion"],
    sentiment: "challenging",
  },

  // ── Death ──────────────────────────────────────────────────────────
  {
    keywords: ["death", "die", "dying", "dead", "dead body", "funeral", "coffin", "cemetery", "grave", "graveyard", "burial", "killed", "murder", "ghost", "ghosts", "spirit", "spirits"],
    meaning: "Death in dreams rarely predicts literal death. It symbolizes transformation, endings, and rebirth. Something in your life is concluding — a relationship, a career phase, an old identity — making space for something new. Death dreams are among the most powerful transformation signals in the psyche.",
    jungianLayer: "The archetype of transformation par excellence. Death in dreams is the ego's symbolic surrender to the Self. What dies is the outgrown identity; what is born is the next iteration of the soul. Jung considered death dreams among the most sacred — they mark genuine psychic metamorphosis.",
    themes: ["death", "supernatural"],
    archetypes: ["self", "shadow", "trickster"],
    emotions: ["fear", "sadness", "awe"],
    sentiment: "transformative",
  },

  // ── Animals ────────────────────────────────────────────────────────
  {
    keywords: ["animal", "animals", "dog", "cat", "snake", "snakes", "bird", "birds", "fish", "horse", "horses", "wolf", "wolves", "bear", "spider", "spiders", "lion", "tiger", "deer", "rabbit", "insect", "insects", "butterfly", "butterflies"],
    meaning: "Animals represent instinctual nature and the body's wisdom. Each animal carries specific symbolic weight: snakes = transformation and healing; dogs = loyalty and instinct; cats = independence and mystery; birds = freedom and spiritual aspiration; fish = unconscious content rising to awareness.",
    jungianLayer: "The animal as instinct-soul. Jung saw animals as direct manifestations of the instinctual psyche — the body's ancient wisdom that consciousness has forgotten how to hear. The specific animal reveals which instinct is seeking expression.",
    themes: ["animals"],
    archetypes: ["shadow", "self"],
    emotions: ["awe", "fear", "confusion"],
    sentiment: "transformative",
  },
  {
    keywords: ["snake", "snakes", "serpent", "serpents", "cobra", "python"],
    meaning: "The snake is the most universal transformation symbol across all cultures. It represents healing, rebirth (shedding skin), kundalini energy, and deep unconscious wisdom. A snake in your dream signals profound transformation is underway — something ancient within you is awakening.",
    jungianLayer: "The ouroboros — the serpent eating its own tail. This is the oldest alchemical symbol: transformation through self-consumption. The snake represents the unconscious in its most potent form — dangerous, healing, and utterly transformative.",
    themes: ["animals"],
    archetypes: ["self", "shadow", "trickster"],
    emotions: ["fear", "awe", "confusion"],
    sentiment: "transformative",
  },

  // ── Naked / Exposure ───────────────────────────────────────────────
  {
    keywords: ["naked", "nude", "naked in public", "undressed", "exposed", "clothes missing", "no clothes", "embarrassed"],
    meaning: "Nakedness in dreams represents vulnerability, authenticity, and fear of being truly seen. You may feel exposed in a waking situation — your defenses are down, your true self is visible. This can be terrifying or liberating depending on the dream's emotional tone.",
    jungianLayer: "The persona stripped away. Nakedness is the ultimate confrontation with authenticity — the social mask removed, the raw self exposed. This dream asks: can you be truly seen? The answer reveals your relationship with the Self.",
    themes: ["naked"],
    archetypes: ["persona", "self"],
    emotions: ["anxiety", "fear", "confusion"],
    sentiment: "challenging",
  },

  // ── Houses / Buildings ─────────────────────────────────────────────
  {
    keywords: ["house", "house", "home", "building", "room", "rooms", "basement", "attic", "kitchen", "bedroom", "bathroom", "door", "doors", "window", "windows", "stairs", "staircase", "hallway", "corridor", "mansion", "castle", "palace"],
    meaning: "Houses represent the psyche itself. Different rooms correspond to different aspects of consciousness: the attic = higher mind and spiritual aspirations; the basement = the unconscious and repressed material; the kitchen = transformation and nourishment; the bedroom = intimacy and the private self.",
    jungianLayer: "The house as mandala of the psyche. Jung saw the house as the most complete symbol of the self — each room a chamber of consciousness, each floor a level of awareness. To explore a house in a dream is to explore your own soul.",
    themes: ["house"],
    archetypes: ["self", "shadow"],
    emotions: ["confusion", "awe", "peace"],
    sentiment: "transformative",
  },

  // ── Vehicles ───────────────────────────────────────────────────────
  {
    keywords: ["car", "cars", "driving", "drive", "vehicle", "vehicles", "train", "trains", "bus", "plane", "airplane", "boat", "boats", "ship", "ships", "bicycle", "motorcycle", "steering", "wheel", "crash", "crashed"],
    meaning: "Vehicles represent how you navigate life — your sense of direction and control. Driving smoothly = confidence in your path; losing control = anxiety about life direction; being a passenger = feeling powerless; crashing = fear of failure or a situation spinning out of control.",
    jungianLayer: "The vehicle as the ego's relationship to the Self's journey. Who drives? Where to? At what speed? These questions reveal how consciousness relates to the deeper trajectory of your life.",
    themes: ["vehicle"],
    archetypes: ["hero", "self"],
    emotions: ["anxiety", "fear", "joy"],
    sentiment: "neutral",
  },

  // ── Exams / Tests ──────────────────────────────────────────────────
  {
    keywords: ["exam", "exams", "test", "testing", "school", "classroom", "study", "studying", "homework", "grade", "grades", "fail", "failing", "unprepared", "forgot", "forget"],
    meaning: "Exam dreams reflect self-evaluation and fear of being judged. You may feel unprepared for a life challenge, or you're holding yourself to impossibly high standards. These dreams often appear before major decisions or performance situations.",
    jungianLayer: "The exam as the psyche's self-assessment. This dream is the inner critic made manifest — the part of you that demands perfection and fears exposure. It asks: whose standards are you really being measured against?",
    themes: ["exam"],
    archetypes: ["persona", "wise_old_man"],
    emotions: ["anxiety", "fear", "confusion"],
    sentiment: "challenging",
  },

  // ── Being Lost ─────────────────────────────────────────────────────
  {
    keywords: ["lost", "lose", "losing", "can't find", "cannot find", "maze", "labyrinth", "confused", "confusion", "disoriented", "wander", "wandering", "searching", "search"],
    meaning: "Being lost represents uncertainty about your direction in life. You may be at a crossroads, questioning your choices, or feeling disconnected from your purpose. This dream invites you to trust your inner compass rather than external maps.",
    jungianLayer: "The labyrinth of the unconscious. Being lost is the ego's admission that it doesn't know the way — and that's precisely where transformation begins. The old maps no longer work; the psyche is inviting you to develop a new relationship with direction itself.",
    themes: ["lost"],
    archetypes: ["hero", "self"],
    emotions: ["confusion", "anxiety", "fear"],
    sentiment: "challenging",
  },

  // ── Nature ─────────────────────────────────────────────────────────
  {
    keywords: ["forest", "woods", "tree", "trees", "mountain", "mountains", "garden", "flower", "flowers", "desert", "jungle", "field", "meadow", "storm", "thunder", "lightning", "sun", "moon", "stars", "sky", "clouds", "earthquake", "volcano", "fire", "flames"],
    meaning: "Nature in dreams reflects your relationship with the natural world within and around you. Forests = the unconscious; mountains = spiritual aspiration and challenge; gardens = cultivated inner life; storms = emotional turbulence; fire = transformation and passion; the sun = consciousness; the moon = the unconscious.",
    jungianLayer: "Nature as the landscape of the psyche. Every natural feature is a feature of your inner world. The forest is where you meet the shadow; the mountain is where you seek the Self; the garden is the cultivated self; the storm is the eruption of the unconscious.",
    themes: ["nature"],
    archetypes: ["self", "great_mother", "shadow"],
    emotions: ["awe", "fear", "peace"],
    sentiment: "transformative",
  },

  // ── Family / People ────────────────────────────────────────────────
  {
    keywords: ["mother", "father", "parent", "parents", "sister", "brother", "sibling", "children", "child", "baby", "family", "husband", "wife", "partner", "friend", "stranger", "strangers", "crowd", "people"],
    meaning: "People in dreams often represent aspects of yourself rather than literal individuals. Your mother may represent nurturing or smothering; your father may represent authority or protection; a stranger may represent unknown potential. Consider what quality each person embodies — that quality lives in you.",
    jungianLayer: "The cast of characters as archetypal fragments. Every person in your dream is a projection of some aspect of your own psyche. The mother is the Great Mother archetype; the father is the Wise Old Man; the stranger is the unknown Self. Dream analysis asks: what part of me does this person represent?",
    themes: ["family"],
    archetypes: ["great_mother", "wise_old_man", "anima", "animus", "shadow"],
    emotions: ["love", "fear", "sadness", "joy"],
    sentiment: "neutral",
  },

  // ── Work / Career ──────────────────────────────────────────────────
  {
    keywords: ["work", "office", "job", "boss", "manager", "colleague", "coworker", "meeting", "presentation", "deadline", "project", "career", "promotion", "fired", "resign", "quit"],
    meaning: "Work dreams reflect your relationship with achievement, responsibility, and identity. They may signal career anxiety, imposter syndrome, or a calling toward more meaningful work. Consider whether the dream shows you thriving or struggling — this reveals your unconscious assessment of your current path.",
    jungianLayer: "Work as the arena of persona development. The workplace is where you construct your social identity — and where that identity is most vulnerable to collapse. Work dreams ask: is your persona aligned with your Self, or are you performing a role that no longer fits?",
    themes: ["work"],
    archetypes: ["persona", "hero", "wise_old_man"],
    emotions: ["anxiety", "fear", "joy"],
    sentiment: "neutral",
  },

  // ── Supernatural ───────────────────────────────────────────────────
  {
    keywords: ["god", "goddess", "angel", "angels", "demon", "demons", "devil", "heaven", "hell", "prayer", "pray", "pray", "miracle", "magic", "magical", "supernatural", "divine", "sacred", "ritual", "ceremony", "temple", "church", "mosque", "shrine"],
    meaning: "Supernatural elements represent contact with the deepest layers of the psyche — the archetypal realm where personal and collective unconscious merge. These dreams carry numinous energy and often mark spiritual turning points. Pay close attention to the emotions — awe indicates genuine contact with the Self.",
    jungianLayer: "The archetypal realm made visible. Supernatural dreams are encounters with the objective psyche — the layer of mind that transcends personal experience and touches the collective. Jung called these 'big dreams' — they carry the weight of the entire human heritage.",
    themes: ["supernatural"],
    archetypes: ["self", "wise_old_man", "great_mother", "divine_child"],
    emotions: ["awe", "fear", "peace", "joy"],
    sentiment: "transformative",
  },

  // ── Colors ─────────────────────────────────────────────────────────
  {
    keywords: ["red", "blue", "green", "yellow", "purple", "white", "black", "orange", "pink", "gold", "silver", "color", "colors", "colour", "colours"],
    meaning: "Colors in dreams carry emotional and archetypal weight. Red = passion, anger, vital energy; Blue = calm, spirituality, communication; Green = growth, healing, nature; Yellow = intellect, joy, caution; Purple = spirituality, mystery, royalty; White = purity, new beginnings; Black = the unknown, the shadow, potential; Gold = the Self, enlightenment, value.",
    jungianLayer: "Color as emotional tone of the archetype. Jung noted that color dreams often accompany heightened emotional states — the psyche painting in the hues of feeling. Each color is a frequency of emotional experience.",
    themes: [],
    archetypes: ["self"],
    emotions: ["awe", "joy", "peace"],
    sentiment: "neutral",
  },

  // ── Numbers ────────────────────────────────────────────────────────
  {
    keywords: ["number", "numbers", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "hundred", "thousand"],
    meaning: "Numbers in dreams carry archetypal significance. One = unity, the Self; Two = duality, partnership, conflict; Three = synthesis, creativity, the divine; Four = stability, wholeness, the mandala; Five = change, the human form; Seven = spiritual perfection, completion; Ten = wholeness, the complete cycle.",
    jungianLayer: "Number as archetypal structure. Jung saw numbers as the most primitive archetypes of order — the psyche's innate sense of pattern and wholeness. The number in your dream reveals the archetypal structure of the situation.",
    themes: [],
    archetypes: ["self"],
    emotions: ["awe", "confusion"],
    sentiment: "neutral",
  },
];

// ─── THEME INTERPRETATIONS ──────────────────────────────────────────────────────

export interface ThemeInterpretation {
  theme: DreamTheme;
  name: string;
  icon: string;
  coreMeaning: string;
  psychologicalLayer: string;
  spiritualLayer: string;
  integrationAdvice: string;
  questions: string[];
}

export const THEME_INTERPRETATIONS: Record<DreamTheme, ThemeInterpretation> = {
  falling: {
    theme: "falling",
    name: "Falling",
    icon: "🌀",
    coreMeaning: "Loss of control, surrender, and the ego's confrontation with the unknown",
    psychologicalLayer: "You're experiencing anxiety about a situation where you feel powerless. The ground represents stability — and you're losing your grip on it. This often appears during major life transitions, relationship shifts, or career changes where old certainties dissolve.",
    spiritualLayer: "Falling is the soul's invitation to trust the void. Many spiritual traditions teach that you must fall before you can fly. Your dream may be asking you to surrender control and trust that the universe will catch you — or that you'll discover you have wings.",
    integrationAdvice: "Identify where in waking life you feel you're losing control. Practice surrender — not resignation, but the active trust that you can handle whatever comes. Journal about what 'ground' you're afraid of losing.",
    questions: [
      "What situation in your life feels unstable right now?",
      "What are you afraid will happen if you let go?",
      "Is there something you need to surrender to move forward?",
    ],
  },
  flying: {
    theme: "flying",
    name: "Flying",
    icon: "🕊️",
    coreMeaning: "Freedom, transcendence, expanded consciousness, and liberation from limitations",
    psychologicalLayer: "You've broken through a psychological barrier. Flying dreams often follow moments of insight, achievement, or emotional release. You're experiencing a sense of mastery and freedom — the constraints that once bound you have loosened their grip.",
    spiritualLayer: "Flight is the soul's natural state. Many mystics describe spiritual awakening as a kind of flying — the consciousness unbound from earthly concerns. Your dream may signal a genuine expansion of awareness, a taste of your higher nature.",
    integrationAdvice: "Notice what you're flying over and how you feel. High, clear flight = spiritual aspiration; low, weaving flight = staying grounded while expanding. Capture this feeling of freedom and anchor it in your waking life through creative expression or physical movement.",
    questions: [
      "What limitation have you recently overcome?",
      "How does freedom feel in your body?",
      "Where else in your life can you apply this sense of liberation?",
    ],
  },
  being_chased: {
    theme: "being_chased",
    name: "Being Chased",
    icon: "🏃",
    coreMeaning: "Avoidance, the shadow's pursuit, and the call to face what you've been running from",
    psychologicalLayer: "Something in your unconscious is demanding attention, and you're avoiding it. The pursuer represents a disowned aspect of yourself — a feeling, a memory, a quality you've rejected. The more you run, the more it chases. The only way out is through.",
    spiritualLayer: "The shadow chases us until we turn to face it. This is one of the most important spiritual dynamics: what we refuse to integrate pursues us as fate. Your dream is an invitation to turn around and meet what you've been avoiding — it carries a gift you need.",
    integrationAdvice: "In your next waking meditation, imagine turning to face your pursuer. Ask: 'What do you want to tell me? What do you carry for me?' The answer may surprise you — the monster often transforms into a guide when finally faced.",
    questions: [
      "What are you avoiding in your waking life?",
      "What quality do you refuse to acknowledge in yourself?",
      "If you turned to face your pursuer, what do you think it would say?",
    ],
  },
  teeth: {
    theme: "teeth",
    name: "Teeth",
    icon: "🦷",
    coreMeaning: "Personal power, communication anxiety, and the cracking of the social persona",
    psychologicalLayer: "You're anxious about how you present yourself to the world. Teeth are your smile's architecture — they represent your social confidence and communication ability. Losing them signals fear of embarrassment, powerlessness, or saying the wrong thing.",
    spiritualLayer: "Teeth represent the visible skeleton — the structural facade of identity. Their loss is the persona's collapse, which paradoxically opens the door to authentic selfhood. When the mask crumbles, what remains is real.",
    integrationAdvice: "Examine where you feel your social confidence is shaky. Are you performing a role that doesn't fit? Practice authentic communication — say what you actually mean, even if it's imperfect. Authenticity is more powerful than perfection.",
    questions: [
      "Where do you feel your social confidence is fragile?",
      "Are you performing a version of yourself that feels exhausting?",
      "What would authentic self-expression look like for you right now?",
    ],
  },
  water: {
    theme: "water",
    name: "Water",
    icon: "🌊",
    coreMeaning: "The unconscious mind, emotional depths, and the flow of psychic energy",
    psychologicalLayer: "Water is the most fundamental dream symbol — it IS the unconscious. The condition of the water reflects the condition of your emotional life. Calm water = emotional peace; turbulent water = emotional upheaval; deep water = contact with the collective unconscious.",
    spiritualLayer: "Water is the primordial substance — the first element, the mother of all life. In dreams, water connects you to the deepest layers of being. To enter water is to enter the womb of the psyche, where transformation and rebirth occur.",
    integrationAdvice: "Pay attention to the water's condition and your relationship to it. Were you swimming (engaged with emotions), watching from shore (observing emotions), drowning (overwhelmed), or floating (at peace)? Each reveals your current emotional stance.",
    questions: [
      "What is the emotional climate of your life right now?",
      "Are you engaging with your feelings or observing them from a distance?",
      "What is your unconscious trying to tell you through the water's condition?",
    ],
  },
  death: {
    theme: "death",
    name: "Death",
    icon: "💀",
    coreMeaning: "Transformation, endings, rebirth, and the death of the outgrown self",
    psychologicalLayer: "Something in your life is ending — a relationship, a career phase, an identity, a way of being. Death dreams are transformation dreams. They signal that an old version of you is dying to make space for the next iteration. This is not loss; this is metamorphosis.",
    spiritualLayer: "Death is the most sacred archetype. Every spiritual tradition teaches that you must die before you can be reborn — not physically, but psychologically. The ego must surrender to the Self. Your dream marks a genuine spiritual threshold.",
    integrationAdvice: "Identify what is ending in your life. Grieve it fully — death dreams require grief work. Then ask: what is being born? What new version of you is emerging from this ending? Honor both the death and the birth.",
    questions: [
      "What in your life is coming to an end?",
      "What old identity are you ready to release?",
      "Who are you becoming on the other side of this transformation?",
    ],
  },
  animals: {
    theme: "animals",
    name: "Animals",
    icon: "🐾",
    coreMeaning: "Instinctual wisdom, the body's intelligence, and the wild self",
    psychologicalLayer: "Animals represent your instinctual nature — the part of you that operates on body wisdom rather than conscious thought. The specific animal reveals which instinct is seeking expression. A dog = loyalty and companionship; a cat = independence and mystery; a bird = freedom and perspective.",
    spiritualLayer: "Animals are the soul's instinctual guides. They carry the wisdom of the body, the ancient knowing that predates consciousness. To dream of animals is to receive messages from the deepest, oldest layers of your being.",
    integrationAdvice: "Research the specific animal in your dream. What qualities does it embody? How do those qualities show up (or fail to show up) in your life? The animal is asking you to reclaim an instinctual capacity you've neglected.",
    questions: [
      "What quality does this animal represent?",
      "Where in your life do you need more (or less) of this quality?",
      "What is your body trying to tell you through this animal?",
    ],
  },
  naked: {
    theme: "naked",
    name: "Nakedness",
    icon: "👤",
    coreMeaning: "Vulnerability, authenticity, and the confrontation with the unmasked self",
    psychologicalLayer: "You feel exposed — your defenses are down, your true self is visible, and you're uncertain whether you'll be accepted. This dream appears when you're in situations where you can't hide behind your usual persona.",
    spiritualLayer: "Nakedness is the soul's natural state. Before the persona, before the social mask, you are raw and real. This dream asks: can you be truly seen? Can you stand in your authenticity even when it feels vulnerable?",
    integrationAdvice: "Notice how you felt in the dream. Shame = you're still identified with the persona and fear exposure. Indifference or joy = you're developing a healthier relationship with authentic selfhood. Practice being seen in small, safe ways.",
    questions: [
      "Where in your life do you feel exposed or vulnerable?",
      "What are you afraid people will see if you're truly authentic?",
      "What would it feel like to be fully seen and still loved?",
    ],
  },
  exam: {
    theme: "exam",
    name: "Exams & Tests",
    icon: "📝",
    coreMeaning: "Self-evaluation, performance anxiety, and the inner critic",
    psychologicalLayer: "You're holding yourself to impossibly high standards. The exam represents the inner critic — the voice that says you're not good enough, not prepared enough, not smart enough. This dream often appears before major life challenges or performance situations.",
    spiritualLayer: "The exam is the soul's self-assessment. It asks: are you living in alignment with your values? Are you prepared for the next stage of your journey? This is not about external judgment — it's about internal integrity.",
    integrationAdvice: "Identify the inner critic's voice. Whose standards are you really measuring yourself against? Often it's a parent's, teacher's, or society's voice — not your own. Practice self-compassion and define success on your own terms.",
    questions: [
      "Whose standards are you measuring yourself against?",
      "What would 'passing' look like by your own definition?",
      "Where do you need to offer yourself more grace?",
    ],
  },
  lost: {
    theme: "lost",
    name: "Being Lost",
    icon: "🧭",
    coreMeaning: "Uncertainty, disorientation, and the search for direction",
    psychologicalLayer: "You're at a crossroads and don't know which way to go. The old maps no longer work — the path that once made sense now feels confusing. This dream appears during major life transitions when you're between identities.",
    spiritualLayer: "Being lost is the sacred disorientation that precedes genuine discovery. The ego doesn't know the way — and that's exactly where transformation begins. The psyche is inviting you to develop an inner compass rather than relying on external directions.",
    integrationAdvice: "Stop trying to find the path. Instead, cultivate stillness and listen. The way forward often reveals itself not through frantic searching but through quiet receptivity. Trust that the path will appear when you're ready to walk it.",
    questions: [
      "What decision or direction are you uncertain about?",
      "What old maps (beliefs, expectations) no longer serve you?",
      "What would it feel like to trust your inner compass?",
    ],
  },
  house: {
    theme: "house",
    name: "Houses & Buildings",
    icon: "🏠",
    coreMeaning: "The psyche itself — each room a chamber of consciousness",
    psychologicalLayer: "The house is the most complete symbol of the self. The attic represents higher mind and spiritual aspirations; the basement represents the unconscious and repressed material; the main floor represents everyday consciousness; each room is a different aspect of your personality.",
    spiritualLayer: "The house is the mandala of the soul. To explore a house in a dream is to explore your own inner landscape. New rooms = undiscovered potential; locked rooms = denied aspects of self; the foundation = your core beliefs and values.",
    integrationAdvice: "Map the house. Which rooms did you visit? What was their condition? Were there rooms you've never seen before? Each room is an aspect of yourself waiting to be explored. Start with the rooms that felt most significant.",
    questions: [
      "Which rooms stood out and what was their condition?",
      "What aspect of yourself does each room represent?",
      "Are there rooms you've been avoiding? What might they contain?",
    ],
  },
  vehicle: {
    theme: "vehicle",
    name: "Vehicles & Travel",
    icon: "🚗",
    coreMeaning: "How you navigate life — your sense of direction, control, and momentum",
    psychologicalLayer: "The vehicle represents your ego's relationship to your life journey. Who's driving? Where are you going? How fast? A smooth drive = confidence; losing control = anxiety; being a passenger = feeling powerless; crashing = fear of failure.",
    spiritualLayer: "The vehicle is the ego's chariot — the vehicle of consciousness on its journey through life. The question is always: is the ego driving, or is the Self? When the ego drives alone, the journey is limited. When the Self guides, the journey becomes destiny.",
    integrationAdvice: "Examine your relationship to the vehicle. Are you driving or being driven? Is the journey smooth or turbulent? This reveals how you relate to your own life direction. Practice taking the wheel with conscious intention.",
    questions: [
      "Who was driving and how did that feel?",
      "Where were you headed and did you know the way?",
      "What does this reveal about how you navigate your waking life?",
    ],
  },
  nature: {
    theme: "nature",
    name: "Nature & Landscape",
    icon: "🌿",
    coreMeaning: "Your relationship with the natural world within and around you",
    psychologicalLayer: "Nature in dreams reflects your inner landscape. Forests = the unconscious; mountains = aspiration and challenge; gardens = cultivated inner life; deserts = spiritual dryness; storms = emotional turbulence; sunshine = clarity and joy.",
    spiritualLayer: "Nature is the psyche's original home. Before civilization, before language, we were nature. Dream nature reconnects you with the primordial self — the part of you that is continuous with the earth, the sky, the seasons.",
    integrationAdvice: "Notice the quality of the nature in your dream. Was it welcoming or threatening? Were you in harmony with it or fighting it? This reveals your relationship with your own natural rhythms and instincts.",
    questions: [
      "What was the quality of the natural landscape?",
      "How did you relate to it — in harmony or in conflict?",
      "What natural element felt most significant and what does it represent for you?",
    ],
  },
  family: {
    theme: "family",
    name: "Family & Relationships",
    icon: "👨‍👩‍👧‍👦",
    coreMeaning: "Archetypal fragments of the self projected onto familiar people",
    psychologicalLayer: "People in dreams often represent aspects of yourself. Your mother may represent nurturing or smothering; your father may represent authority or protection; siblings may represent competing aspects of your identity. Consider what quality each person embodies.",
    spiritualLayer: "Family is the first temple of the soul. Our earliest relationships shape our archetypal templates for love, authority, trust, and belonging. Dream family members are not just people — they are the living archetypes that structure your inner world.",
    integrationAdvice: "For each person in your dream, ask: what quality do they represent? Then ask: where does that quality show up in me? The mother in you needs nurturing; the father in you needs to provide structure; the child in you needs play.",
    questions: [
      "What quality does each person in your dream represent?",
      "How do those qualities show up in your own personality?",
      "What relationship with yourself needs attention?",
    ],
  },
  work: {
    theme: "work",
    name: "Work & Career",
    icon: "💼",
    coreMeaning: "Your relationship with achievement, responsibility, and professional identity",
    psychologicalLayer: "Work dreams reflect your relationship with achievement and identity. They may signal career anxiety, imposter syndrome, or a calling toward more meaningful work. The workplace is where you construct your social identity — and where it's most vulnerable.",
    spiritualLayer: "Work is the arena where soul meets world. Your career is not just a job — it's how you contribute your unique gifts to the collective. Work dreams ask: is your outer work aligned with your inner calling?",
    integrationAdvice: "Examine your relationship to work in the dream. Were you thriving or struggling? Competent or overwhelmed? This reveals your unconscious assessment of your current professional path. Consider whether your work aligns with your deeper values.",
    questions: [
      "How did you feel in your work dream — competent or overwhelmed?",
      "Does your current work align with your deeper values and calling?",
      "What would meaningful work look like for you?",
    ],
  },
  supernatural: {
    theme: "supernatural",
    name: "Supernatural & Divine",
    icon: "✨",
    coreMeaning: "Contact with the deepest layers of the psyche — the archetypal realm",
    psychologicalLayer: "Supernatural elements represent contact with the collective unconscious — the layer of mind that transcends personal experience and touches universal patterns. These are Jung's 'big dreams' — they carry numinous weight and often mark spiritual turning points.",
    spiritualLayer: "The supernatural is the natural, seen from a deeper perspective. Gods, angels, demons, miracles — these are the psyche's encounter with its own depth. Such dreams are sacred. They mark moments when the veil between ordinary consciousness and the archetypal realm grows thin.",
    integrationAdvice: "Approach these dreams with reverence. Record them immediately — they fade quickly. Notice the emotions: awe indicates genuine contact with the archetypal; fear indicates the ego's resistance to the numinous. These dreams carry messages that can reshape your life.",
    questions: [
      "What supernatural element appeared and what did it represent?",
      "How did you feel — awe, fear, peace, or something else?",
      "What message or guidance did you receive?",
    ],
  },
};

// ─── ARCHETYPE PROFILES ─────────────────────────────────────────────────────────

export interface ArchetypeProfile {
  archetype: DreamArchetype;
  name: string;
  icon: string;
  description: string;
  positiveExpression: string;
  shadowExpression: string;
  integrationPath: string;
}

export const ARCHETYPE_PROFILES: Record<DreamArchetype, ArchetypeProfile> = {
  shadow: {
    archetype: "shadow",
    name: "The Shadow",
    icon: "🌑",
    description: "The shadow contains everything you've rejected, denied, or disowned about yourself. It's not evil — it's simply unconscious. The shadow carries gold: qualities you need but refuse to claim.",
    positiveExpression: "When integrated, the shadow becomes your depth, your authenticity, your power. It holds creativity, passion, and strength you've been afraid to express.",
    shadowExpression: "When unintegrated, the shadow projects onto others — you see in them what you refuse to see in yourself. It appears as the pursuer, the monster, the enemy.",
    integrationPath: "Turn toward what frightens you. Ask: what quality does this shadow figure represent? Can I claim this quality in a conscious, healthy way? The shadow becomes ally when finally faced.",
  },
  anima: {
    archetype: "anima",
    name: "The Anima",
    icon: "🌸",
    description: "The anima is the feminine dimension of the male psyche (and more broadly, the receptive, intuitive, feeling dimension present in all people). She appears as a female figure in men's dreams.",
    positiveExpression: "When integrated, the anima brings emotional depth, relational wisdom, creative inspiration, and connection to the soul. She is the bridge to the unconscious.",
    shadowExpression: "When unintegrated, the anima appears as moodiness, emotional manipulation, irrationality, or projection onto women. She becomes the femme fatale or the helpless maiden.",
    integrationPath: "Develop your feeling function. Practice emotional literacy. Engage with art, music, and poetry. The anima speaks in the language of the heart — learn to listen.",
  },
  animus: {
    archetype: "animus",
    name: "The Animus",
    icon: "⚔️",
    description: "The animus is the masculine dimension of the female psyche (and more broadly, the assertive, logical, action-oriented dimension present in all people). He appears as a male figure in women's dreams.",
    positiveExpression: "When integrated, the animus brings clarity of thought, decisive action, spiritual focus, and the capacity to translate insight into form. He is the sword of discernment.",
    shadowExpression: "When unintegrated, the animus appears as rigid opinions, harsh self-criticism, domination, or projection onto men. He becomes the tyrant or the cold intellectual.",
    integrationPath: "Develop your thinking function. Practice clear communication. Take decisive action aligned with your values. The animus speaks in the language of truth — learn to wield it with compassion.",
  },
  self: {
    archetype: "self",
    name: "The Self",
    icon: "☀️",
    description: "The Self is the central archetype — the totality of the psyche, the union of conscious and unconscious. It's the God-image within, the organizing principle of your entire being.",
    positiveExpression: "When experienced, the Self brings wholeness, meaning, and profound peace. It appears as mandalas, divine figures, precious objects, or symbols of unity and completion.",
    shadowExpression: "The Self cannot be shadow — but the ego can resist the Self, leading to feelings of meaninglessness, fragmentation, and spiritual emptiness.",
    integrationPath: "The path to the Self is individuation — becoming who you truly are. This requires integrating all other archetypes. Meditation, active imagination, and dream work are the primary doors.",
  },
  persona: {
    archetype: "persona",
    name: "The Persona",
    icon: "🎭",
    description: "The persona is the mask you wear in public — the social identity you present to the world. It's necessary for functioning, but dangerous when mistaken for the true self.",
    positiveExpression: "When conscious, the persona is a flexible tool — you can adapt it to different situations without losing yourself. It's the interface between your inner world and outer reality.",
    shadowExpression: "When unconscious, the persona becomes rigid and suffocating. You become your job title, your social role, your reputation. The true self starves behind the mask.",
    integrationPath: "Ask: who am I when no one is watching? Practice authenticity in small ways. Let the mask become transparent rather than opaque. The persona should serve you, not imprison you.",
  },
  wise_old_man: {
    archetype: "wise_old_man",
    name: "The Wise Old Man",
    icon: "🧙",
    description: "The Wise Old Man (or Wise Old Woman) represents spiritual wisdom, guidance, and the accumulated knowledge of the psyche. He appears as a sage, guru, teacher, or elder.",
    positiveExpression: "When integrated, the Wise Old Man brings insight, perspective, and the ability to see through complexity to simplicity. He is the inner mentor who knows the way.",
    shadowExpression: "When unintegrated, he appears as dogmatism, rigid ideology, or projection onto gurus and authorities. The shadow Wise Old Man demands obedience rather than offering wisdom.",
    integrationPath: "Develop your own inner authority. Trust your accumulated wisdom. Seek guidance from within before seeking it from without. You are becoming your own wise elder.",
  },
  great_mother: {
    archetype: "great_mother",
    name: "The Great Mother",
    icon: "🌺",
    description: "The Great Mother represents nurturing, fertility, creativity, and the containing aspect of the psyche. She is the source of life and the embrace of unconditional love.",
    positiveExpression: "When integrated, the Great Mother brings self-nurturance, creative fertility, emotional security, and the capacity to hold space for yourself and others.",
    shadowExpression: "When unintegrated, she appears as the devouring mother — smothering, controlling, or emotionally absent. She becomes the witch who traps or the mother who won't let go.",
    integrationPath: "Learn to mother yourself. Provide your own emotional security. Nurture your creative projects. The Great Mother's gift is the knowledge that you are held — even when you must hold yourself.",
  },
  trickster: {
    archetype: "trickster",
    name: "The Trickster",
    icon: "🃏",
    description: "The Trickster disrupts, surprises, and breaks rules. He is the agent of chaos who paradoxically brings order — the fool who is wiser than the king.",
    positiveExpression: "When integrated, the Trickster brings humor, flexibility, and the ability to see through rigidity. He teaches through paradox and breaks you open with laughter.",
    shadowExpression: "When unintegrated, the Trickster appears as self-sabotage, chaos, or destructive humor. He becomes the class clown who can't be serious or the saboteur who undermines your own success.",
    integrationPath: "Learn to laugh at yourself. Embrace paradox. Allow space for play and spontaneity. The Trickster's gift is the freedom that comes from not taking yourself too seriously.",
  },
  hero: {
    archetype: "hero",
    name: "The Hero",
    icon: "⚡",
    description: "The Hero represents the ego's journey toward consciousness. She faces challenges, overcomes obstacles, and returns transformed. The Hero's journey is the journey of individuation.",
    positiveExpression: "When integrated, the Hero brings courage, perseverance, and the willingness to face what must be faced. She is the part of you that rises to the occasion.",
    shadowExpression: "When unintegrated, the Hero becomes the warrior who never rests, the perfectionist who can't accept limitation, or the savior who tries to fix everyone else.",
    integrationPath: "Face your dragons — but know when the battle is over. The Hero's ultimate task is to lay down the sword and rest in wholeness. Courage includes the courage to be vulnerable.",
  },
  divine_child: {
    archetype: "divine_child",
    name: "The Divine Child",
    icon: "👶",
    description: "The Divine Child represents potential, new beginnings, and the sacred vulnerability of emerging consciousness. She is the future self, the inner child, the miracle of new life.",
    positiveExpression: "When integrated, the Divine Child brings wonder, creativity, spontaneity, and the capacity for new beginnings. She is the part of you that still believes in miracles.",
    shadowExpression: "When unintegrated, the Divine Child appears as naivety, helplessness, or arrested development. She becomes the eternal child who refuses to grow up or take responsibility.",
    integrationPath: "Honor your inner child. Play. Create. Allow yourself to be a beginner. The Divine Child's gift is the capacity to begin again — always, always, always.",
  },
};

// ─── EMOTION PROFILES ───────────────────────────────────────────────────────────

export interface EmotionProfile {
  emotion: DreamEmotion;
  name: string;
  icon: string;
  meaning: string;
  bodyLocation: string;
  integrationPath: string;
}

export const EMOTION_PROFILES: Record<DreamEmotion, EmotionProfile> = {
  joy: {
    emotion: "joy",
    name: "Joy",
    icon: "😊",
    meaning: "Joy in dreams signals alignment — you're in contact with what truly matters to you. This is the psyche's confirmation that you're on the right path.",
    bodyLocation: "Heart and chest — the center of love and expansion.",
    integrationPath: "Anchor this feeling. What in the dream brought joy? How can you bring more of that into waking life?",
  },
  fear: {
    emotion: "fear",
    name: "Fear",
    icon: "😨",
    meaning: "Fear in dreams points to what you're avoiding. It's not a warning to stop — it's a compass pointing toward what needs your attention.",
    bodyLocation: "Gut and solar plexus — the center of survival instinct.",
    integrationPath: "Don't run from the fear. Move toward it gently. Ask: what is this fear protecting? What would happen if I faced it?",
  },
  anxiety: {
    emotion: "anxiety",
    name: "Anxiety",
    icon: "😰",
    meaning: "Anxiety in dreams reflects unresolved tension — you're carrying worry that hasn't been processed. The dream is trying to complete the stress cycle.",
    bodyLocation: "Chest and throat — the center of unexpressed concern.",
    integrationPath: "Name the anxiety. What specifically are you worried about? Write it down. Anxiety loses power when brought into the light of consciousness.",
  },
  sadness: {
    emotion: "sadness",
    name: "Sadness",
    icon: "😢",
    meaning: "Sadness in dreams signals grief — something needs to be mourned. This may be a loss, an ending, or simply the sadness of being human.",
    bodyLocation: "Heart and throat — the center of love and expression.",
    integrationPath: "Allow the sadness. Don't fix it, don't minimize it. Grieve fully. Sadness is love with nowhere to go — give it somewhere to go through tears, art, or conversation.",
  },
  anger: {
    emotion: "anger",
    name: "Anger",
    icon: "😠",
    meaning: "Anger in dreams signals a boundary violation — yours or someone else's. It's the psyche's way of saying: something needs to change.",
    bodyLocation: "Jaw, fists, and stomach — the center of protective energy.",
    integrationPath: "Where is your anger pointing? What boundary has been crossed? Anger is sacred when it protects what matters. Use it constructively.",
  },
  confusion: {
    emotion: "confusion",
    name: "Confusion",
    icon: "😵‍💫",
    meaning: "Confusion in dreams signals that your conscious mind doesn't yet have the framework to understand what the unconscious is showing you. More integration is needed.",
    bodyLocation: "Head and mind — the center of cognition.",
    integrationPath: "Don't force clarity. Sit with the confusion. The meaning will emerge when you're ready. Record the dream and revisit it later — patterns reveal themselves over time.",
  },
  peace: {
    emotion: "peace",
    name: "Peace",
    icon: "😌",
    meaning: "Peace in dreams signals integration — the conscious and unconscious are in harmony. You're experiencing a moment of wholeness.",
    bodyLocation: "Whole body — the sensation of unity.",
    integrationPath: "Remember this peace. It's available to you even in waking chaos. Return to this feeling through breath, meditation, or simply remembering.",
  },
  awe: {
    emotion: "awe",
    name: "Awe",
    icon: "🤩",
    meaning: "Awe in dreams signals contact with the numinous — the archetypal realm. You've touched something larger than your personal self.",
    bodyLocation: "Chest and upward — the center of transcendence.",
    integrationPath: "Honor this experience. Awe dreams are sacred. They connect you to the transpersonal dimension of your psyche. Record them with care.",
  },
  loneliness: {
    emotion: "loneliness",
    name: "Loneliness",
    icon: "😔",
    meaning: "Loneliness in dreams signals disconnection — from yourself, from others, or from meaning. A part of you feels abandoned or unseen.",
    bodyLocation: "Heart and chest — the center of connection.",
    integrationPath: "What part of you feels lonely? Often it's the inner child, the creative self, or the spiritual self. Offer that part attention and companionship.",
  },
  love: {
    emotion: "love",
    name: "Love",
    icon: "💗",
    meaning: "Love in dreams signals connection — with yourself, with another, or with life itself. It's the psyche's most affirmative emotion.",
    bodyLocation: "Heart — the center of all centers.",
    integrationPath: "Who or what did you love in the dream? That quality is alive in you. Nurture it. Love is the ultimate integrator — it makes wholeness possible.",
  },
};
