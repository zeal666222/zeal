// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Complete Tarot Deck (78 cards: 22 Major + 56 Minor Arcana)
// ═══════════════════════════════════════════════════════════════════════════════
// Each card has upright/reversed meanings, element, numerology, and symbolism.
// Used by the gamified tarot reading page for accurate, rich interpretations.
// ═══════════════════════════════════════════════════════════════════════════════

export type TarotSuit = "wands" | "cups" | "swords" | "pentacles";
export type TarotElement = "fire" | "water" | "air" | "earth";

export interface TarotCard {
  id: string;
  name: string;
  arcana: "major" | "minor";
  suit?: TarotSuit;
  number: number;
  element?: TarotElement;
  symbol: string;
  keywords: string[];
  upright: string;
  reversed: string;
  description: string;
  symbolism: string;
  guidance: string;
}

// ─── Major Arcana (22 cards) ──────────────────────────────────────────────────

const RAW_MAJOR_ARCANA: Omit<TarotCard, "symbolism" | "guidance">[] = [
  {
    id: "major-0", name: "The Fool", arcana: "major", number: 0,
    symbol: "\ud83c\udccf", element: "air",
    keywords: ["beginnings", "innocence", "spontaneity", "leap of faith"],
    upright: "New beginnings, innocence, spontaneity, a free spirit. You stand at the edge of a great adventure. Trust the journey.",
    reversed: "Recklessness, risk-taking, holding back from a leap you need to take. Fear of the unknown is keeping you small.",
    description: "The Fool steps off a cliff with eyes turned skyward \u2014 pure trust, pure potential.",
  },
  {
    id: "major-1", name: "The Magician", arcana: "major", number: 1,
    symbol: "\ud83c\udfaf", element: "air",
    keywords: ["manifestation", "willpower", "skill", "resourcefulness"],
    upright: "Manifestation, willpower, skill. You have everything you need. Channel your focus and act with intention.",
    reversed: "Manipulation, untapped talents, trickery. Your gifts are scattered or being misused. Reclaim your power.",
    description: "As above, so below. The Magician channels the four elements through sheer will.",
  },
  {
    id: "major-2", name: "The High Priestess", arcana: "major", number: 2,
    symbol: "\ud83c\udf19", element: "water",
    keywords: ["intuition", "mystery", "inner wisdom", "the subconscious"],
    upright: "Intuition, mystery, inner knowledge. The answer you seek is within. Be still and listen to your deeper knowing.",
    reversed: "Secrets, withdrawal, disconnection from intuition. You're ignoring your inner voice. Surface noise is drowning out wisdom.",
    description: "She sits between the pillars of light and shadow, keeper of what cannot be spoken.",
  },
  {
    id: "major-3", name: "The Empress", arcana: "major", number: 3,
    symbol: "\ud83d\udc51", element: "earth",
    keywords: ["abundance", "nurturing", "fertility", "nature"],
    upright: "Abundance, nurturing, fertility, beauty. A time of growth and creation. Connect with nature and your senses.",
    reversed: "Creative block, dependence, neglecting self-care. You've been giving from an empty cup. Refill first.",
    description: "The mother of the deck \u2014 abundance flows where she walks.",
  },
  {
    id: "major-4", name: "The Emperor", arcana: "major", number: 4,
    symbol: "\u2694\ufe0f", element: "fire",
    keywords: ["authority", "structure", "stability", "leadership"],
    upright: "Authority, structure, control, father figure. Establish order and take command of your situation with confidence.",
    reversed: "Tyranny, rigidity, loss of control. Too much structure suffocates. Bend before you break.",
    description: "He sits on a stone throne \u2014 unyielding, structured, the architect of empires.",
  },
  {
    id: "major-5", name: "The Hierophant", arcana: "major", number: 5,
    symbol: "\ud83d\udcff", element: "earth",
    keywords: ["tradition", "conformity", "education", "spiritual wisdom"],
    upright: "Tradition, spiritual wisdom, education, institutions. Seek a teacher or return to foundational practices.",
    reversed: "Rebellion, unorthodox approaches, questioning authority. The old ways no longer serve you. Find your own path.",
    description: "Bridge between heaven and earth, keeper of sacred tradition.",
  },
  {
    id: "major-6", name: "The Lovers", arcana: "major", number: 6,
    symbol: "\ud83d\udc95", element: "air",
    keywords: ["love", "harmony", "choices", "alignment"],
    upright: "Love, harmony, partnerships, value alignment. A meaningful choice approaches \u2014 choose with your heart and values.",
    reversed: "Disharmony, imbalance, misalignment. A relationship or decision feels off. Re-examine what you truly value.",
    description: "Two figures beneath an angel \u2014 the sacred choice between paths.",
  },
  {
    id: "major-7", name: "The Chariot", arcana: "major", number: 7,
    symbol: "\ud83c\udfc7", element: "water",
    keywords: ["determination", "willpower", "victory", "control"],
    upright: "Determination, willpower, victory through control. Harness opposing forces and drive forward with focus.",
    reversed: "Lack of direction, aggression, feeling out of control. You're pulling in too many directions. Choose one path.",
    description: "Two sphinxes pull in different directions \u2014 only the charioteer's will unites them.",
  },
  {
    id: "major-8", name: "Strength", arcana: "major", number: 8,
    symbol: "\ud83e\udd81", element: "fire",
    keywords: ["courage", "patience", "compassion", "inner strength"],
    upright: "Courage, patience, compassion, gentle strength. True power is soft. Tame your fears with love, not force.",
    reversed: "Self-doubt, weakness, insecurity. You're being harder on yourself than the situation demands. Find your gentle core.",
    description: "A woman gently closes a lion's mouth \u2014 compassion conquers where force fails.",
  },
  {
    id: "major-9", name: "The Hermit", arcana: "major", number: 9,
    symbol: "\ud83c\udfee", element: "earth",
    keywords: ["solitude", "introspection", "inner guidance", "wisdom"],
    upright: "Solitude, introspection, inner guidance. Step back from the noise. The answers you seek are found in stillness.",
    reversed: "Isolation, loneliness, withdrawal. Solitude has become exile. It's time to reconnect with the world.",
    description: "An old man holds his lantern on a mountaintop \u2014 light for those who seek.",
  },
  {
    id: "major-10", name: "Wheel of Fortune", arcana: "major", number: 10,
    symbol: "\ud83c\udfa1", element: "fire",
    keywords: ["cycles", "destiny", "turning point", "luck"],
    upright: "Cycles, destiny, a turning point. The wheel turns \u2014 what was down rises. Embrace change as the natural order.",
    reversed: "Bad luck, resistance to change, feeling stuck. You're fighting the turn. Surrender to the cycle.",
    description: "The great wheel spins \u2014 what rises must descend, what falls shall rise again.",
  },
  {
    id: "major-11", name: "Justice", arcana: "major", number: 11,
    symbol: "\u2696\ufe0f", element: "air",
    keywords: ["truth", "fairness", "karma", "accountability"],
    upright: "Truth, fairness, karmic justice. Actions have consequences \u2014 and rewards. The truth will be seen.",
    reversed: "Unfairness, dishonesty, avoiding accountability. Something is out of balance. Own your part in it.",
    description: "She holds the sword of truth and the scales of karma \u2014 nothing escapes either.",
  },
  {
    id: "major-12", name: "The Hanged Man", arcana: "major", number: 12,
    symbol: "\ud83d\udd2e", element: "water",
    keywords: ["surrender", "new perspective", "letting go", "pause"],
    upright: "Surrender, new perspective, letting go. Sometimes you must hang upside down to see clearly. Pause and shift your view.",
    reversed: "Stalling, resistance, unnecessary sacrifice. You're stuck because you refuse to let go of something.",
    description: "Suspended by one foot, he sees the world inverted \u2014 and finally understands.",
  },
  {
    id: "major-13", name: "Death", arcana: "major", number: 13,
    symbol: "\ud83e\udd8b", element: "water",
    keywords: ["transformation", "endings", "transition", "rebirth"],
    upright: "Transformation, endings that lead to rebirth. Something must die for something new to live. This is not loss \u2014 it is metamorphosis.",
    reversed: "Resistance to change, stagnation, fear of endings. You're clinging to what's already gone. Release it.",
    description: "Not physical death, but the death of who you were \u2014 the butterfly emerging.",
  },
  {
    id: "major-14", name: "Temperance", arcana: "major", number: 14,
    symbol: "\ud83c\udffa", element: "fire",
    keywords: ["balance", "moderation", "patience", "harmony"],
    upright: "Balance, moderation, patience, purpose. Mix opposing forces with care. The middle path leads to peace.",
    reversed: "Imbalance, excess, impatience. You've gone too far in one direction. Recalibrate.",
    description: "An angel pours water between two cups \u2014 the art of perfect balance.",
  },
  {
    id: "major-15", name: "The Devil", arcana: "major", number: 15,
    symbol: "\ud83d\udd25", element: "earth",
    keywords: ["shadow", "attachment", "addiction", "restriction"],
    upright: "Shadow self, attachment, addiction, restriction. Examine what binds you. The chains are looser than you think \u2014 you could remove them.",
    reversed: "Releasing limiting beliefs, breaking free, facing your shadow. You're beginning to see the cage for what it is.",
    description: "The chains around their necks are loose \u2014 they could leave at any time. Why don't they?",
  },
  {
    id: "major-16", name: "The Tower", arcana: "major", number: 16,
    symbol: "\u26a1", element: "fire",
    keywords: ["upheaval", "revelation", "sudden change", "awakening"],
    upright: "Sudden upheaval, revelation, awakening. What was built on false foundations crumbles. The destruction is necessary liberation.",
    reversed: "Avoiding disaster, delaying the inevitable, fear of change. The tower still stands, but the cracks are visible.",
    description: "Lightning strikes the tower \u2014 what was built on lies cannot stand.",
  },
  {
    id: "major-17", name: "The Star", arcana: "major", number: 17,
    symbol: "\u2b50", element: "air",
    keywords: ["hope", "faith", "renewal", "inspiration"],
    upright: "Hope, faith, renewal, serenity. After the storm, the star appears. Trust that the universe is guiding you toward healing.",
    reversed: "Despair, lack of faith, disconnection from hope. You've lost sight of the light. It's still there \u2014 look up.",
    description: "A naked woman pours living water under an infinite sky of stars.",
  },
  {
    id: "major-18", name: "The Moon", arcana: "major", number: 18,
    symbol: "\ud83c\udf19", element: "water",
    keywords: ["illusion", "fear", "subconscious", "intuition"],
    upright: "Illusion, fear, the subconscious, intuition. Not everything is as it seems. Trust your instincts through the fog.",
    reversed: "Release of fear, clarity emerging, confronting the subconscious. The fog is lifting. Face what you've been avoiding.",
    description: "A path between two towers, a wolf and dog howling \u2014 the landscape of dreams and fears.",
  },
  {
    id: "major-19", name: "The Sun", arcana: "major", number: 19,
    symbol: "\u2600\ufe0f", element: "fire",
    keywords: ["joy", "success", "vitality", "confidence"],
    upright: "Joy, success, vitality, confidence. Everything the light touches is yours. Celebrate, create, shine.",
    reversed: "Temporary sadness, dimmed confidence, inner child wounds. The sun is behind the clouds, not gone. Tend to your inner child.",
    description: "A child rides naked in the sunlight \u2014 pure joy, pure being.",
  },
  {
    id: "major-20", name: "Judgement", arcana: "major", number: 20,
    symbol: "\ud83d\udcef", element: "fire",
    keywords: ["rebirth", "calling", "reckoning", "absolution"],
    upright: "Rebirth, inner calling, reckoning. A higher version of yourself is asking to be born. Answer the call.",
    reversed: "Self-doubt, refusal of the call, harsh self-judgement. You're judging yourself by old standards. Forgive and rise.",
    description: "An angel sounds the trumpet \u2014 the dead rise, not in horror, but in recognition.",
  },
  {
    id: "major-21", name: "The World", arcana: "major", number: 21,
    symbol: "\ud83c\udf0d", element: "earth",
    keywords: ["completion", "integration", "accomplishment", "wholeness"],
    upright: "Completion, integration, accomplishment, travel. A great cycle closes. You've arrived \u2014 celebrate, then begin again.",
    reversed: "Incompletion, shortcuts, seeking closure. Something remains unfinished. Don't leave before the lesson is learned.",
    description: "A dancer within a laurel wreath \u2014 the world complete, the dance eternal.",
  },
];

// One-line, actionable guidance per Major Arcana card (pre-coded).
const MAJOR_GUIDANCE: Record<string, string> = {
  "major-0": "Take the small leap you keep rehearsing — pack light.",
  "major-1": "Start today with the skills already on your table.",
  "major-2": "Sit with the question before demanding the answer.",
  "major-3": "Create or nurture something tangible — including yourself.",
  "major-4": "Set one rule that makes the hard decision automatic.",
  "major-5": "Ask someone who has already walked this path.",
  "major-6": "Choose what you value, not what is easiest to defend.",
  "major-7": "Pick one direction and hold the reins steady.",
  "major-8": "Handle the difficult thing gently today.",
  "major-9": "Book one honest hour alone — the answer is in the quiet.",
  "major-10": "Say yes to the turn happening right now.",
  "major-11": "Make the fair call even when it costs you.",
  "major-12": "Look at the problem from the other side before acting.",
  "major-13": "End one thing cleanly so the next can begin.",
  "major-14": "Mix slowly — find the middle dose.",
  "major-15": "Name the chain you are ready to stop tolerating.",
  "major-16": "Let the false thing fall; rebuild on what is true.",
  "major-17": "Ask for the bigger version — then take one step toward it.",
  "major-18": "Write down what the fog is hiding; trust your gut through it.",
  "major-19": "Do the joyful thing in the open.",
  "major-20": "Answer the call you have been postponing.",
  "major-21": "Close the loop — finish, celebrate, then set the next horizon.",
};

export const MAJOR_ARCANA: TarotCard[] = RAW_MAJOR_ARCANA.map((c) => ({
  ...c,
  symbolism: c.description,
  guidance: MAJOR_GUIDANCE[c.id] ?? "Turn this card's keywords into one concrete next step.",
}));

// ─── Minor Arcana (56 cards) ──────────────────────────────────────────────────

const MINOR_MEANINGS: Record<TarotSuit, { element: TarotElement; theme: string; keywords: string[][] }> = {
  wands: {
    element: "fire",
    theme: "passion, creativity, action, ambition",
    keywords: [
      ["inspiration", "new opportunity"], ["planning", "decisions"], ["expansion", "foresight"],
      ["celebration", "harmony"], ["conflict", "competition"], ["victory", "recognition"],
      ["bravery", "confrontation"], ["speed", "momentum"], ["resilience", "persistence"],
      ["burden", "responsibility"], ["creativity", "invention"], ["action", "initiative"],
    ],
  },
  cups: {
    element: "water",
    theme: "emotions, relationships, love, intuition",
    keywords: [
      ["new love", "emotional beginning"], ["partnership", "connection"], ["celebration", "friendship"],
      ["apathy", "reevaluation"], ["loss", "grief"], ["nostalgia", "memories"],
      ["fantasy", "imagination"], ["withdrawal", "self-care"], ["fulfillment", "satisfaction"],
      ["harmony", "alignment"], ["creativity", "expression"], ["emotional mastery", "joy"],
    ],
  },
  swords: {
    element: "air",
    theme: "thought, communication, conflict, truth",
    keywords: [
      ["clarity", "breakthrough"], ["difficult choices", "tension"], ["heartbreak", "sorrow"],
      ["rest", "recuperation"], ["conflict", "disagreement"], ["transition", "change"],
      ["deception", "strategy"], ["restriction", "limitation"], ["anxiety", "worry"],
      ["ending", "release"], ["truth", "intellect"], ["mental clarity", "resolution"],
    ],
  },
  pentacles: {
    element: "earth",
    theme: "material world, work, finances, health",
    keywords: [
      ["opportunity", "prosperity"], ["balance", "adaptation"], ["skill", "craftsmanship"],
      ["security", "conservation"], ["disruption", "change"], ["generosity", "giving"],
      ["patience", "investment"], ["diligence", "effort"], ["self-sufficiency", "independence"],
      ["inheritance", "legacy"], ["abundance", "luxury"], ["manifestation", "wealth"],
    ],
  },
};

interface MinorDetail { up: string; rev: string; sym: string; guide: string }

// Pre-coded Rider-Waite meanings for all 56 Minor Arcana cards.
// Order per suit: Ace, 2-10, Page, Knight, Queen, King.
const MINOR_DETAIL: Record<TarotSuit, MinorDetail[]> = {
  wands: [
    { up: "A burst of creative fire — a new project, idea or adventure is ready to launch. Channel the excitement before it fades.", rev: "The spark is sputtering — delays, false starts or scattered energy. Get clear on one direction before you act.", sym: "A hand rising from the clouds holds a wand blooming with leaves — pure life force.", guide: "Start the thing you've been circling — today, in one small step." },
    { up: "Vision meets planning. You hold the seeds of several ideas; the moment asks you to choose and sequence them.", rev: "Fear of choosing wrong keeps everything stuck in your head. A stalled plan needs a decision, not more polish.", sym: "A figure balances two wands like a juggler beneath stars — skill in formation.", guide: "Write the plan in one sentence, then pick the first action." },
    { up: "Growth and foresight — your work begins to expand, and collaborators appear. Early results prove the vision.", rev: "Progress slows through poor planning or blocked teamwork. Look ahead, but don't neglect the now.", sym: "A figure watches ships full of supplies on the horizon — the harvest is coming.", guide: "Send the message that opens the next door." },
    { up: "A milestone worth celebrating. Stability after effort — home, team and work align for a moment.", rev: "A false sense of security, or resistance to moving on from a finished chapter. Celebrate, then continue.", sym: "Wands planted on a castle tower with a crowd rejoicing below — homecoming.", guide: "Mark the win with the people who helped." },
    { up: "Creative friction — competition and clashing opinions that sharpen you. Pick your battles deliberately.", rev: "Conflict fatigue or avoidance of an unavoidable disagreement. Inner tension leaks outward.", sym: "Five figures cross staves in a meadow — the beautiful mess of competition.", guide: "Turn one argument into a single agreed next step." },
    { up: "Victory and recognition. Public confidence rises; your effort is seen. Ride the momentum graciously.", rev: "Pride before a fall, withheld recognition, or self-doubt after a win. Humility restores the applause.", sym: "A crowned rider enters the city on a white horse, welcomed — triumph.", guide: "Accept the compliment without shrinking or inflating." },
    { up: "Defending your ground. You hold the higher position — protect your vision with nerve, not noise.", rev: "Feeling overwhelmed or fighting battles that aren't yours. Reassess which ground actually matters.", sym: "A lone figure on a cliff fends off six staves below — hold your height.", guide: "Say no to one demand that isn't yours." },
    { up: "Swift movement. Events accelerate and news travels fast — a current is carrying your plans forward.", rev: "Delays and obstacles — the flying wands tangle in nets. Slow down deliberately rather than force it.", sym: "Eight wands fly through clear sky — unhindered speed.", guide: "Move on the news the moment it lands." },
    { up: "Resilience near the finish. Wounded but standing, you've survived most of this — hold the line one more day.", rev: "Exhaustion, paranoia or refusing help. The last battle is fought best with borrowed strength.", sym: "A bandaged figure leans on his ninth wand, eight behind him — nearly done.", guide: "Ask for the backup you've been refusing." },
    { up: "A heavy but chosen burden. Responsibility multiplies — carry it with purpose; the reward is close.", rev: "Overcommitment breaking your back. Drop the duties that were never yours and delegate.", sym: "A figure staggers under a bundle of ten wands toward a city — the load of ambition.", guide: "Put down one obligation this week." },
    { up: "A messenger of enthusiasm — a new idea, invitation or playful spark of curiosity. Explore it without over-committing.", rev: "Impulsive starts, gossip, or a 'bright idea' that scatters focus. Test enthusiasm before you fund it.", sym: "A young figure gazes at a wand like a talisman — possibility and wonder.", guide: "Follow the curiosity for one hour, no pressure." },
    { up: "Adventurous charge — energy, boldness and a travel-or-project opportunity galloping in. Act fast, aim first.", rev: "Haste, bravado or a brilliant start that crashes without a plan. Slow the charge down.", sym: "A knight on a dappled horse charges through the desert — fearless momentum.", guide: "Aim the energy before you spend it." },
    { up: "Confident, warm, magnetic leadership. Lead with courage and inclusion — your fire draws people in.", rev: "Jealousy, smothering warmth or burnout masked as control. Soften the flame.", sym: "A queen on a throne of lions and sunflowers holds a flowering wand — fertile command.", guide: "Lead one conversation with warmth first." },
    { up: "A seasoned leader who earned the crown — vision, enterprise and command. Build the house, not just the fire.", rev: "Tyranny, a plan without follow-through, or impatience with slower allies.", sym: "A king on a throne of salamanders holds a flowering wand — fire under rule.", guide: "Make the decision you've been deferring." },
  ],
  cups: [
    { up: "An emotional beginning — love, compassion or creativity overflows a full chalice. Let the feeling in.", rev: "Blocked feelings or an emotional dry spell — pouring from an empty vessel. Refill first.", sym: "A cup brimming with five streams beneath a dove and stars — abundance of feeling.", guide: "Name one true feeling out loud today." },
    { up: "A genuine partnership forms — mutual respect, attraction, a balanced exchange. The bond is real.", rev: "Imbalance, mistrust, or a meeting of minds that never quite happened. Re-balance the give and take.", sym: "Two figures exchange cups beneath a caduceus and lion — the pact.", guide: "Offer the fair trade, not the rescue." },
    { up: "Friendship, community and celebration. A reunion or shared joy lifts the heart. Show the gratitude.", rev: "Over-indulgence, gossip or cancelled plans — a party that isolates instead of connects.", sym: "Three dancers link arms with cups raised under vines — shared joy.", guide: "Call the friend you keep meaning to." },
    { up: "Apathy and re-evaluation — you're ignoring an offered cup while staring at the ones you already have. Look up.", rev: "Waking from boredom and finally taking the offered cup. A new engagement begins.", sym: "A seated figure ignores a cloud-hand's offered cup — the unnoticed gift.", guide: "Notice one offer you've been dismissing." },
    { up: "Loss and grief — three cups spilled, two still standing. Mourn honestly, then turn toward what survives.", rev: "Acceptance and moving on. The two standing cups finally get their attention.", sym: "A cloaked figure among spilled cups with a bridge ahead — grief with an exit.", guide: "Grieve the three; commit to the two." },
    { up: "Nostalgia and sweet memory — something or someone from the past returns in kindness.", rev: "Living in the past, or outgrowing an old comfort. The memory is sweet; the present is ready.", sym: "Two children among cups of flowers with a village behind — the golden past.", guide: "Let one old memory teach, not chain." },
    { up: "Fantasy and wishful thinking — six cloud-cups of symbols dangle in front of you. Separate the real from the shimmering.", rev: "Clarity after confusion — goals get aligned and the right cup is finally chosen.", sym: "A figure faces six cloud-cups holding trophies, dragons and jewels — the imagination's buffet.", guide: "Pick one wish and turn it into a plan." },
    { up: "Walking away from plenty — the cups left behind were never the point. A deeper quest calls.", rev: "Stalling at the edge of a needed departure, or returning to what you outgrew. Check the motive.", sym: "A figure climbs away from eight stacked cups toward mountains — renunciation.", guide: "Leave what no longer feeds you — kindly." },
    { up: "Wish fulfilment and quiet satisfaction — a dream visibly realised and enjoyed.", rev: "Surface gratitude masking a deeper lack, or over-indulgence. The wish gets redefined.", sym: "A content figure sits before nine ornate cups, arms crossed — the wish come true.", guide: "Savour it fully — gratitude multiplies." },
    { up: "Emotional completion — family, harmony, legacy; a rainbow of ten cups over the home.", rev: "A disrupted ideal, or redefining what 'family' and 'enough' actually mean for you.", sym: "A couple, children and dogs beneath ten cups in a rainbow — lasting joy.", guide: "Give ten real minutes to your own table." },
    { up: "A gentle message of feeling — an invitation, a dream, creative news delivered shyly but sincerely.", rev: "Moodiness, escapism, or a tender message you don't want to hear.", sym: "A young figure in iris robes peers into a cup holding a fish — wonder delivered.", guide: "Receive the soft message without fixing it." },
    { up: "A romantic, imaginative offer rides in — charm, quests, an emotional messenger bearing flowers.", rev: "Mood swings, all-show emotion, or a fantasy that never delivers. Dreamers need deadlines.", sym: "A knight on a grey horse carries a white-rose cup through wetlands — the feeling quest.", guide: "Judge romance by its follow-through." },
    { up: "Emotional mastery — nurturing, deeply intuitive, boundless empathy you can trust.", rev: "Smothering care, codependence or feelings used as leverage. The cup gives until dry.", sym: "A queen on a throne of shells and lotuses, the moon at her feet — feeling grown up.", guide: "Nurture others only from your own full cup." },
    { up: "Emotional balance and diplomacy — the mature feeler who leads with calm water and generous boundaries.", rev: "Mood control, stoic manipulation, or volatility behind a polite mask.", sym: "A king on a throne above a stormy sea holds an empty cup — command of feeling.", guide: "Decide with heart and head in the same room." },
  ],
  swords: [
    { up: "Mental clarity and breakthrough — truth cuts through the fog. A new idea or decision wins.", rev: "Confused thinking or a truth delayed — the blade turns inward as self-doubt.", sym: "A hand from a cloud-crown holds an upright double-edged sword — clear truth.", guide: "Say the true thing plainly, once." },
    { up: "A difficult choice held in careful balance — two swords, blindfold calm. Weigh it, but don't stall forever.", rev: "Information overload ending, the blindfold coming off, a stalemate finally breaking.", sym: "A blindfolded figure by the sea holds two crossed swords — the held decision.", guide: "Choose with the information you have." },
    { up: "Heartbreak and sorrow — a painful truth lands. Grieve honestly; the storm behind is real.", rev: "Recovery begins — the end of a sorrow cycle and the first acceptance.", sym: "A heart pierced by three swords under rain — grief with dignity.", guide: "Let the sadness be sadness, not a story." },
    { up: "Rest and recuperation — a deliberate pause after strain. The mind sharpens in stillness.", rev: "Restlessness, a forced early return, or rest becoming a hiding place. Rise when ready.", sym: "A figure lies on a stone tomb, two crossed swords above, two below — chosen stillness.", guide: "Protect one full hour of true rest." },
    { up: "Conflict and disagreement — a win that costs dignity, or a lesson about what's worth fighting for.", rev: "Reconciliation, walking away from hollow victories, or the quiet aftermath of defeat.", sym: "A figure gathers fallen swords while rivals walk off — the pyrrhic field.", guide: "Choose peace over being right — once." },
    { up: "Transition and recovery — a journey from turbulent water toward calmer shores. Moving on works.", rev: "Resistance to leaving, unfinished business, or a move that keeps getting postponed.", sym: "Two figures and a child cross a lake from barren to green trees — passage.", guide: "Book the move, literal or symbolic." },
    { up: "Strategy and stealth — not every battle is won head-on. Take only what you actually need.", rev: "A plan exposed, guilt surfacing, or deception ending. The sneak steps into daylight.", sym: "A figure removes five swords from a camp while two guards watch from the hill — the cautious raid.", guide: "Act quietly; skip the announcement." },
    { up: "Restriction and feeling trapped — bound and blindfolded, yet the bonds are looser than they look.", rev: "Freedom returns — self-imposed limits release and perspective comes back.", sym: "A lightly bound figure stands among eight swords near water — a prison of belief.", guide: "Test one 'can't' as if it were a 'can'." },
    { up: "Anxiety and worry — the midnight mind circling one fear. Dawn breaks sooner than dread promises.", rev: "Hope returns — worries spoken aloud shrink, and shame releases its grip.", sym: "A seated figure wakes among nine swords on a dark bed — the 3 a.m. mind.", guide: "Tell one worry to one person." },
    { up: "An ending and release — the painful cycle completes, and it proves survivable. The worst clears the ground.", rev: "Recovery, survival, lessons kept — the first light after the darkest night of the cycle.", sym: "A figure pinned beneath ten swords while dawn breaks over the sea — the bottom, and beyond it.", guide: "Let the chapter close before judging it." },
    { up: "A new idea or message — sharp curiosity, careful observation, truth delivered early and awkwardly.", rev: "Harsh words, all-talk schemes, or an idea that needs more research before it speaks.", sym: "A young figure holds a sword and peers cautiously at it — the sharp beginner.", guide: "Write the idea down before you defend it." },
    { up: "A fast, direct mind charges — bold action and decisive communication that cuts the wind.", rev: "Reckless bluntness, burnout, or a charge abandoned mid-gallop. Speed without aim.", sym: "A knight on a white horse rides with sword raised through storm-blown clouds — the mental cavalry.", guide: "Cut one knot today, cleanly." },
    { up: "Clear-eyed honesty and independent judgment — perception that sees through excuses with grace.", rev: "Cold bitterness or clarity used as a weapon. Boundaries harden into walls.", sym: "A queen on a throne of skulls and butterflies holds a raised sword — experience plus lightness.", guide: "Speak one hard truth with warmth." },
    { up: "Intellectual authority and strategy — the decided mind that governs fairly and finishes things.", rev: "Manipulation, cruelty dressed as logic, or a plan that punishes instead of solves.", sym: "A king on a throne of butterflies and skulls holds a sword pointed down — judgment ready.", guide: "Decide by principle, not by mood." },
  ],
  pentacles: [
    { up: "A material seed — a real opportunity for money, health or craft. Plant it with attention.", rev: "A missed opportunity or unplanted seed — the gift stays in the pocket.", sym: "A hand offers a huge coin inside a wreath above a garden gate — the tangible gift.", guide: "Take the first concrete step on the offer." },
    { up: "Balance and adaptation — juggling two worlds (work and life, saving and spending) with flexible skill.", rev: "Overloaded plates and resisted change — the balls keep multiplying.", sym: "A figure juggles two coins before a gateway and the sea — the flexible porter.", guide: "Re-balance one part of the schedule today." },
    { up: "Skill and craftsmanship — the work gains recognition from people who know the craft. Teamwork builds.", rev: "Mediocrity, shortcuts, or a team quietly pulling apart. Quality slips with standards.", sym: "A mason consults a plan while a bishop and merchant watch — the guild approves.", guide: "Ask the expert one sharper question." },
    { up: "Security and conservation — a stable base, held resources, and the wisdom to save. Watch the grip.", rev: "An over-tight fist loosening — generosity, spending, or financial anxiety releasing.", sym: "A seated figure clutches one coin, sits on two, guards two more — the protected vault.", guide: "Spend one resource — money or time — freely today." },
    { up: "Disruption and hardship — a cold season for body or wallet. Help is passing by; notice it.", rev: "Recovery and aid accepted — the way out of scarcity finally gets seen.", sym: "Two figures trudge past a lit stained-glass window of five coins — want beside plenty.", guide: "Knock on the door you keep walking past." },
    { up: "Generosity and reciprocity — giving and receiving in fair measure. Support flows both ways.", rev: "One-sided giving, charity with strings, or debt quietly out of balance.", sym: "A merchant weighs coins for kneeling paupers — the measured hand.", guide: "Give or ask — whichever is truer today." },
    { up: "Patience and investment — work is planted and growing. Assess whether the crop is worth the wait.", rev: "Doubt in a plan, delayed harvest, or a strategy rethink the wait is forcing.", sym: "A figure leans on his staff watching seven pentacles grow — the patient farmer.", guide: "Review the investment before reacting to it." },
    { up: "Diligence and mastery — skilled repetition and apprentice focus deepen the craft. Flow is available.", rev: "Perfectionism, rushed work, or drudgery without learning. The chisel dulls.", sym: "A craftsman shapes a coin while two finished hang nearby — devoted work.", guide: "Do one task with full attention." },
    { up: "Self-sufficiency and quiet luxury — the garden is full; independence earned and enjoyed.", rev: "Over-reliance on things, isolation inside plenty, or a harvest left untended.", sym: "A woman admires her ninth coin in a vineyard, grape-robe on — ripe independence.", guide: "Enjoy the fruit without buying more." },
    { up: "Legacy and shared wealth — family fortune, long-horizon assets, abundance that outlives you.", rev: "Family tension over money, legacy disputes, or a plan that forgets the next generation.", sym: "Three generations, dogs and a mansion beneath ten coins in a garland — lasting plenty.", guide: "Protect one thing that outlives you." },
    { up: "A studious beginner — a practical opportunity, course or work-news arrives with real potential.", rev: "Procrastination, a missed study chance, or money daydreams without homework.", sym: "A young figure holds a pentacle and studies it — the apprentice's gaze.", guide: "Start the course, or the first lesson." },
    { up: "Reliable progress — a steady, methodical worker or offer arrives. Slow and sure wins here.", rev: "Stagnation, boredom, or a promise circling the same paddock without moving.", sym: "A knight on a dark horse holds a coin at a walk — the deliberate rider.", guide: "Do the boring next step now." },
    { up: "Practical nurture — resourceful, down-to-earth care and reliable provision for what you love.", rev: "Self-sacrifice to depletion, smothering security, or neglecting your own garden.", sym: "A queen on a throne of bulls and owls holds a coin amid wheat and roses — fertile stewardship.", guide: "Budget the one resource you keep leaking." },
    { up: "Material mastery — wealth, enterprise and leadership that turns vision into stable structures.", rev: "Greed, stubborn control, or success without substance — the vault outweighing values.", sym: "A king on a throne of bulls and grapes holds a coin and short sword — the capable steward.", guide: "Build the system, not just the win." },
  ],
};

const SUIT_SYMBOLS: Record<TarotSuit, string[]> = {
  wands:      ["🔥", "🌱", "🚀", "🌻", "⚔️", "🏆", "🛡️", "⚡", "💪", "🏋️", "🎨", "🌟"],
  cups:       ["💗", "🤝", "🎉", "💧", "💔", "🎭", "🦄", "🌊", "😊", "💕", "🎨", "🌈"],
  swords:     ["💡", "⚔️", "💔", "😴", "🌧️", "🌬️", "🎭", "⛓️", "😨", "🍂", "🧠", "☀️"],
  pentacles:  ["⭐", "⚖️", "🛠️", "🏠", "💎", "🙏", "⏳", "🌾", "🌳", "💼", "🏡", "💰"],
};

const COURT_TITLES = ["Page", "Knight", "Queen", "King"];

function buildMinorArcana(): TarotCard[] {
  const cards: TarotCard[] = [];

  for (const [suit, data] of Object.entries(MINOR_MEANINGS) as [TarotSuit, typeof MINOR_MEANINGS[TarotSuit]][]) {
    const details = MINOR_DETAIL[suit]!;
    for (let i = 0; i < 14; i++) {
      const num = i + 1;
      const title = num === 1 ? "Ace" : num >= 11 ? COURT_TITLES[i - 11]! : String(num);
      const name = `${title} of ${suit.charAt(0).toUpperCase() + suit.slice(1)}`;
      const d = details[i]!;
      const kw = data.keywords[i] ?? ["change", "growth"];

      cards.push({
        id: `minor-${suit}-${num}`,
        name,
        arcana: "minor",
        suit,
        number: num,
        element: data.element,
        symbol: SUIT_SYMBOLS[suit]![i] ?? "✨",
        keywords: kw,
        upright: d.up,
        reversed: d.rev,
        description: d.sym,
        symbolism: d.sym,
        guidance: d.guide,
      });
    }
  }

  return cards;
}

export const MINOR_ARCANA: TarotCard[] = buildMinorArcana();
export const FULL_DECK: TarotCard[] = [...MAJOR_ARCANA, ...MINOR_ARCANA];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export interface DrawnCard {
  card: TarotCard;
  isReversed: boolean;
  position: string;
}

export function shuffleDeck(deck: TarotCard[] = FULL_DECK): TarotCard[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function drawCards(
  count: number,
  positions: string[],
  deck: TarotCard[] = FULL_DECK,
): DrawnCard[] {
  const shuffled = shuffleDeck(deck);
  return shuffled.slice(0, count).map((card, i) => ({
    card,
    isReversed: Math.random() < 0.3,
    position: positions[i] ?? `Position ${i + 1}`,
  }));
}

export const SPREADS = {
  single: {
    name: "Single Card",
    count: 1,
    positions: ["Guidance"],
    description: "One card. One truth. Perfect for daily guidance.",
  },
  three: {
    name: "Three-Card Spread",
    count: 3,
    positions: ["Past", "Present", "Future"],
    description: "Past, Present, Future \u2014 the classic timeline reading.",
  },
  love: {
    name: "Love Spread",
    count: 5,
    positions: ["You", "Your Partner", "The Relationship", "Challenge", "Outcome"],
    description: "Five cards exploring the dynamics of love.",
  },
  celtic: {
    name: "Celtic Cross",
    count: 5,
    positions: ["Present", "Challenge", "Foundation", "Recent Past", "Possible Future"],
    description: "A focused 5-card Celtic Cross for quick deep insight.",
  },
} as const;

export type SpreadName = keyof typeof SPREADS;

export const ELEMENT_COLORS: Record<TarotElement, { bg: string; text: string; border: string }> = {
  fire:  { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30" },
  water: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
  air:   { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30" },
  earth: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30" },
};

export const SUIT_GRADIENTS: Record<TarotSuit, string> = {
  wands: "from-orange-500 to-red-600",
  cups: "from-blue-500 to-cyan-600",
  swords: "from-slate-400 to-indigo-600",
  pentacles: "from-emerald-500 to-green-700",
};

export const MAJOR_GRADIENT = "from-violet-600 via-purple-600 to-indigo-700";

// Image paths for Major Arcana cards (22 cards)
export const MAJOR_ARCANA_IMAGES: Record<string, string> = {
  "major-0": "/tarot-cards/tarot-00-fool.png",
  "major-1": "/tarot-cards/tarot-01-magician.png",
  "major-2": "/tarot-cards/tarot-02-high-priestess.png",
  "major-3": "/tarot-cards/tarot-03-empress.png",
  "major-4": "/tarot-cards/tarot-04-emperor.png",
  "major-5": "/tarot-cards/tarot-05-hierophant.png",
  "major-6": "/tarot-cards/tarot-06-lovers.png",
  "major-7": "/tarot-cards/tarot-07-chariot.png",
  "major-8": "/tarot-cards/tarot-08-strength.png",
  "major-9": "/tarot-cards/tarot-09-hermit.png",
  "major-10": "/tarot-cards/tarot-10-wheel-of-fortune.png",
  "major-11": "/tarot-cards/tarot-11-justice.png",
  "major-12": "/tarot-cards/tarot-12-hanged-man.png",
  "major-13": "/tarot-cards/tarot-13-death.png",
  "major-14": "/tarot-cards/tarot-14-temperance.png",
  "major-15": "/tarot-cards/tarot-15-devil.png",
  "major-16": "/tarot-cards/tarot-16-tower.png",
  "major-17": "/tarot-cards/tarot-17-star.png",
  "major-18": "/tarot-cards/tarot-18-moon.png",
  "major-19": "/tarot-cards/tarot-19-sun.png",
  "major-20": "/tarot-cards/tarot-20-judgement.png",
  "major-21": "/tarot-cards/tarot-21-world.png",
};

// ─── Deterministic Reading Builder (pre-coded, no AI required) ────────────────

export interface ReadingCardDetail {
  position: string;
  cardName: string;
  orientation: "upright" | "reversed";
  coreMeaning: string;
  symbolism: string;
  elementalInfluence: string;
  practicalGuidance: string;
}

export interface TarotReading {
  cardDetails: ReadingCardDetail[];
  synthesis: string;
  actionStep: string;
  overallEnergy: string;
}

const POSITION_FRAMING: Record<string, string> = {
  Guidance: "As your guiding card for this moment",
  Past: "Looking back at what shaped this",
  Present: "Here and now",
  Future: "What is moving toward you",
  You: "Your own energy in this",
  "Your Partner": "Their energy in this",
  "The Relationship": "The relationship itself",
  Challenge: "The obstacle to work through",
  Outcome: "Where this is heading",
  Foundation: "What this is built on",
  "Recent Past": "What has just passed",
  "Possible Future": "A path that may open",
};

const ELEMENT_INFLUENCE: Record<TarotElement, string> = {
  fire: "Fire energy pushes this card toward action, courage and desire — something here asks to be done, not just felt.",
  water: "Water energy moves this card through emotion and intuition — the truth here will be felt before it is understood.",
  air: "Air energy frames this card as thought and communication — clarity, words and perspective are the lever.",
  earth: "Earth energy grounds this card in the material world — timing, body and practical resources decide everything.",
};

const ELEMENT_THEME: Record<TarotElement, string> = {
  fire: "action and will",
  water: "feeling and intuition",
  air: "thought and communication",
  earth: "practical stability",
};

function firstSentence(text: string): string {
  const i = text.indexOf(".");
  return i === -1 ? text : text.slice(0, i + 1);
}

export function buildTarotReading(drawn: DrawnCard[]): TarotReading {
  const cardDetails: ReadingCardDetail[] = drawn.map((d) => {
    const framing = POSITION_FRAMING[d.position] ?? `In the ${d.position} position`;
    const meaning = d.isReversed ? d.card.reversed : d.card.upright;
    const lowered = meaning.charAt(0).toLowerCase() + meaning.slice(1);
    const element = d.card.element ?? "air";
    const inward = d.isReversed
      ? " Reversed, this energy turns inward — notice where it is blocked, internalised, or overdone."
      : "";
    return {
      position: d.position,
      cardName: d.card.name + (d.isReversed ? " (Reversed)" : ""),
      orientation: d.isReversed ? "reversed" : "upright",
      coreMeaning: `${framing}, ${lowered}`,
      symbolism: d.card.symbolism,
      elementalInfluence: ELEMENT_INFLUENCE[element] + inward,
      practicalGuidance: d.card.guidance,
    };
  });

  const majors = drawn.filter((d) => d.card.arcana === "major");
  const reversed = drawn.filter((d) => d.isReversed);

  const counts = new Map<TarotElement, number>();
  for (const d of drawn) {
    const el = d.card.element ?? "air";
    counts.set(el, (counts.get(el) ?? 0) + 1);
  }
  let dominant: TarotElement = "air";
  let best = -1;
  for (const [el, n] of counts) {
    if (n > best) {
      best = n;
      dominant = el;
    }
  }

  const drawnBullets = drawn
    .map(
      (d) =>
        `- ${d.position} — ${d.card.name}${d.isReversed ? " (Reversed)" : ""}`,
    )
    .join("\n");

  const threadBullets = drawn
    .map((d) => {
      const meaning = d.isReversed ? d.card.reversed : d.card.upright;
      return `- ${d.position}: ${firstSentence(meaning)}`;
    })
    .join("\n");

  const pictureParts: string[] = [];
  pictureParts.push(
    `Elementally this spread leans ${ELEMENT_THEME[dominant]}.`,
  );
  if (majors.length > 0) {
    pictureParts.push(
      `${majors.length} of ${drawn.length} cards come from the Major Arcana — the themes here are large, karmic, and hard to negotiate around.`,
    );
  } else {
    pictureParts.push(
      "Every card is Minor Arcana — the message is about everyday choices, not sweeping destiny.",
    );
  }
  if (reversed.length > 0) {
    pictureParts.push(
      `${reversed.length} landed reversed, so some of this energy is internal or blocked — name it honestly before you act on it.`,
    );
  }
  pictureParts.push(
    "Hold this reading as a mirror, not a verdict. The cards describe the energy around your question, not a fixed outcome.",
  );

  const synthesis = [
    "**The Cards You Drew**",
    drawnBullets,
    "**Reading the Thread**",
    threadBullets,
    "**The Combined Picture**",
    pictureParts.join(" "),
  ].join("\n\n");

  const actionSource = reversed[0] ?? drawn[drawn.length - 1];
  const actionStep =
    actionSource?.card.guidance ??
    "Turn this card's keywords into one concrete next step today.";

  const energyAnchor = majors[0]?.card.name ?? drawn[0]?.card.name ?? "Guidance";
  const overallEnergy = `${ELEMENT_THEME[dominant]} — ${energyAnchor}`;

  return { cardDetails, synthesis, actionStep, overallEnergy };
}
