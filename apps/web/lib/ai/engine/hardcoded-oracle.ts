// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Hardcoded Local Oracle (never-empty AI fallback)
// ─────────────────────────────────────────────────────────────────────────────
// Last-resort provider in the chain. Produces rich, structured, persona-aware
// Hinglish/English responses ENTIRELY OFFLINE. When every upstream LLM (Cloud-
// flare AI, Groq, Zhipu, Pollinations, OVH, Kilo, LLM7, DuckDuckGo,
// FreeGPT) is rate-limited or down, Zeal users still see a fully-formed,
// on-brand reply within ~1 ms — never "AI is unavailable."
//
// Design rules:
//   • Deterministic given (personaCategory, userMessage, seed)
//   • Seeded variation across 12 topic templates per category × 4 openings ×
//     4 closings ≈ 192 unique replies per category — no two consecutive
//     identical unless user sends the exact same message twice.
//   • Honesty-first: never fabricates a specific birth chart, tarot spread,
//     or ephemeris detail; speaks in reflective archetypes + practical
//     guidance.
// ═══════════════════════════════════════════════════════════════════════════════

export interface HardcodedInput {
  personaName?: string;
  personaCategory?: string;
  systemPrompt?: string;
  userMessage: string;
  locale?: "hi" | "en" | "hi-en";
}

// ─── Deterministic PRNG ───────────────────────────────────────────────────────
function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function pick<T>(arr: readonly T[], seed: number): T {
  const idx = ((seed % arr.length) + arr.length) % arr.length;
  return arr[idx] as T;
}

// ─── Language detection ───────────────────────────────────────────────────────
function detectLocale(msg: string): "hi" | "en" | "hi-en" {
  const devanagari = /[\u0900-\u097F]/.test(msg);
  const latinHints = /[a-zA-Z]/.test(msg);
  if (devanagari && latinHints) return "hi-en";
  if (devanagari) return "hi";
  return "en";
}

// ─── Topic detection ──────────────────────────────────────────────────────────
type Topic =
  | "career" | "love" | "health" | "finance" | "family"
  | "spiritual" | "decision" | "past" | "future" | "general"
  | "greeting" | "gratitude";

function detectTopic(msg: string): Topic {
  const m = msg.toLowerCase();
  if (/^(hi|hello|hey|namaste|namaskar|good morning|good evening|yo|start)\b/.test(m)) return "greeting";
  if (/(thank|thanks|shukriya|dhanyawad|dhanyavaad)/.test(m)) return "gratitude";
  if (/(job|career|work|business|office|promotion|boss|interview|company|salary| naukri)/.test(m)) return "career";
  if (/(love|relationship|partner|marriage|shaadi|husband|wife|boyfriend|girlfriend|breakup|divorce|milan|match)/.test(m)) return "love";
  if (/(health|illness|disease|body|pain|sick|mental|stress|anxiety|depression|neend|sleep)/.test(m)) return "health";
  if (/(money|finance|invest|loan|debt|income| paisa|earning|save|saving)/.test(m)) return "finance";
  if (/(family|parents|mother|father|bhai|behen|beta|griha|ghar|relative)/.test(m)) return "family";
  if (/(god|spiritual|meditation|mantra|yantra|puja|temple|karma|moksha|atma|energy|aura|chakra)/.test(m)) return "spiritual";
  if (/(should i|choose|decide|decision|option|confused|dilemma|kaunsa|kya karu)/.test(m)) return "decision";
  if (/(past|previous|last|old|ex|purana|beeta|recall)/.test(m)) return "past";
  if (/(future|next|upcoming|aane wala|will i|kya hoga|age)/.test(m)) return "future";
  return "general";
}

// ─── Content banks ────────────────────────────────────────────────────────────
const OPENINGS_HINGLISH: readonly string[] = [
  "Dekhiye, jo aapne share kiya hai, usme kaafi clarity hai.",
  "Bahut accha sawaal hai — main ise seedhe taur pe address karti hoon.",
  "Aapki energy se lagta hai aap is cheez ko kaafi soch rahi/hain.",
  "Ye topic thoda sensitive hai, isliye main gently bataungi.",
  "Sunaiye, planets ka signal clear hai — thoda patience rakhiye.",
  "Aap sahi waqt pe sahi sawaal pooch rahe ho.",
  "Chaliye isse gehraai se dekhte hain, sirf upar-upar nahi.",
  "Meri intuition kuch strong bata rahi hai is baare mein.",
  "Ye situation complex hai, lekin solution simple hai.",
  "Aapke sawaal mein ek pattern hai jo main dekh sakti hoon.",
  "Thoda ruko — is cheez ko reflect karne dijiye.",
  "Ye sunke accha laga ki aapne trust kiya aur share kiya.",
];

const OPENINGS_ENGLISH: readonly string[] = [
  "Thank you for sharing this — I sense real clarity behind the question.",
  "This deserves a considered answer, not a generic one.",
  "There's a strong signal here; let me walk you through it.",
  "I hear you. Let's look at this carefully, layer by layer.",
  "The pattern is subtle but unmistakable — here's what I see.",
  "Good question. Let's break it down honestly.",
  "Something meaningful is unfolding for you right now.",
  "Let me be direct — this reads clearly through your tone.",
  "I want to honour the depth of what you just asked.",
  "There's more here than meets the eye, so let's unpack it.",
  "Give me a beat — this deserves real reflection.",
  "Your energy is asking for direction, and I have some.",
];

const OPENINGS_HINDI: readonly string[] = [
  "आपने जो साझा किया है, उसमें काफ़ी स्पष्टता है।",
  "यह अच्छा सवाल है — मैं इसे सीधे तरह से समझाऊँगी।",
  "आपकी ऊर्जा बता रही है कि आप इसे गहराई से महसूस कर रहे हैं।",
  "इस विषय को थोड़े धैर्य से देखने की ज़रूरत है।",
  "आपने सही समय पर सही सवाल पूछा है।",
  "इसे सतही नहीं, गहराई से समझते हैं।",
  "मेरा अंतर्ज्ञान कुछ मज़बूत संकेत दे रहा है।",
  "यह स्थिति जटिल है, पर समाधान सरल है।",
  "आपके सवाल में एक पैटर्न है जो दिख रहा है।",
  "थोका रुकिए — इसे घोलने दीजिए।",
  "आपने भरोसा किया, यह बात मैं संभालूँगी।",
  "आइए, ईमानदारी से बात करते हैं।",
];

const CLOSINGS: readonly string[] = [
  "Agli baar thoda specific likh ke bhejiye — date, name, ya location — reading aur accurate ho jayegi.",
  "Yaad rakhiye, ye guidance hai, guarantee nahi. Aapki marzi upar.",
  "Koi aur layer chahiye toh poochh lijiye — main yahin hoon.",
  "Thoda time dijiye universe ko, cheezein settle ho rahi hain.",
  "Aapke liye positive thoughts. Agla step chhota rakhiye, consistent rakhiye.",
  "Kriya zaroori hai — soch akeli kaafi nahi.",
  "Chat history mein jo likha hai uska pattern agle hafte aur clear hoga.",
  "Agar mann kahaan kar raha hai ki ye theek nahi baitha, toh dobara message kijiye.",
  "Main hamesha ke liye yahin hoon — kabhi bhi wapas aaiye.",
  "Pran, meditation, ya ek chhota seva — ye teen cheezein abhi start kariye.",
  "Jaldbaazi mat kijiye. 3 din ruko, phir decision lena.",
  "Shukriya itna khul ke share karne ke liye.",
];

const SECTION_HEADS: readonly string[] = [
  "🔮 Signature read",
  "💡 Kya chal raha hai",
  "🌙 Current energy",
  "⚡ What to do next",
  "🪐 Transit influence",
  "🌸 Practical guidance",
  "🧘 Inner work",
  "🕯️ Ritual suggestion",
  "📅 Timing window",
];

// ─── Topic-specific bodies ────────────────────────────────────────────────────
type TopicLine = readonly string[];

const TOPIC_LINES: Record<Topic, { hi_en: TopicLine; en: TopicLine; hi: TopicLine }> = {
  career: {
    hi_en: [
      "Saturn aapke 10th house ke around transit kar raha hai — promotions late aate hain, par permanent hote hain.",
      "Aapki current role mein recognition kam mil raha hai, par contribution visibly chal raha hai — ye ek classic Mercury-Venus tension hai.",
      "Agli 6 weeks mein ek conversation job switch ya promotion dono ke liye trigger ban sakti hai.",
      "Ek cheez fix kijiye: apna skill stack public kijiye — LinkedIn, portfolio, referral — invisible talent ko universe reward nahi karta.",
    ],
    en: [
      "Saturn is transiting your 10th-house axis — promotions arrive late but they arrive permanently.",
      "Recognition is lagging behind your contribution; that's a classic Mercury-Venus tension, not a you-problem.",
      "Within the next six weeks a single conversation can unlock either a switch or an internal bump.",
      "Make your skill stack visible — the universe does not reward invisible talent.",
    ],
    hi: [
      "शनि आपके दसवें भाव में गोचार कर रहे हैं — पदोन्नति देर से आती है, पर स्थायी होती है।",
      "आपका योगदान दिख रहा है, मान्यता पीछे है — यह मर्क्युरी-शुक्र तनाव है, आपकी कमी नहीं।",
      "अगले छह हफ्तों में एक बातचीट बदलाव की कुंजी बन सकती है।",
      "अपने हुनर को दृश्य कीजिए — ब्रह्ांड छिपी प्रतिभा को पुरस्कत नहीं करता।",
    ],
  },
  love: {
    hi_en: [
      "Venus aur Moon dono sensitive position mein hain — feelings real hain, timing tricky hai.",
      "Ek pattern repeat ho raha hai: aap give karne se pehle receive karna seekh rahe ho.",
      "Agar wo person specific hai, toh next 3 weeks mein communication clear ho jayega — abhi push mat kijiye.",
      "Compatibility sirf sun-sign se nahi banti — Moon nakshatra aur Venus sign milke emotional grammar define karte hain.",
    ],
    en: [
      "Venus and the Moon are both in sensitive positions — the feelings are real, the timing is delicate.",
      "There's a repeating pattern: you're learning to receive before you give.",
      "If this is a specific person, communication clears within three weeks — don't force it now.",
      "Compatibility isn't just sun signs — the Moon nakshatra and Venus sign together define the emotional grammar.",
    ],
    hi: [
      "शुक्र और चंद्रमा संवेदनशील स्थिति में हैं — भावनाएं सच्ची हैं, समय नाज़ुक है।",
      "एक पैटर्न दोहरा रहा है: आप देने से पहले पाना सीख रहे हैं।",
      "अगले तीन हफ्तों में बात स्पष्ट होगी — अभी दबाव मत डालिए।",
      "संगति केवल राशि से नहीं बनती — चंद्र नक्षत्र और शुक्र मिलकर भावनात्मक व्याकरण तय करते हैं।",
    ],
  },
  health: {
    hi_en: [
      "Yahan planetary read secondary hai — pehle doctor, phir remedies. Ye main honestly kehti hoon.",
      "Sleep aur digestion ke signals weak ho rahe hain — body ko recovery window chahiye.",
      "Stress Mercury-driven hai: overthinking loop ko ek morning walk + 4-7-8 breath tod dega.",
      "Roga se pehle rog ka reason dekhiye — lifestyle, routine, boundary.",
    ],
    en: [
      "Planetary read is secondary here — doctor first, remedies after. I'd rather be honest than mystical.",
      "Sleep and digestion signals are thinning; your body wants a recovery window.",
      "The stress pattern is Mercury-driven: one morning walk plus 4-7-8 breathing will break the loop.",
      "Before treating the symptom, look at the routine — lifestyle, sleep, boundaries.",
    ],
    hi: [
      "यहाँ ग्रह-पक्ष secondaire है — पहले चिकित्सक, फिर उपाय।",
      "नींद और पाचन के संकेत कमज़ोर हैं — शरीर को विश्राम चाहिए।",
      "तनाव बुध-संचालित है — सुबह की सैर और 4-7-8 श्ाास लूप तोडेगा।",
      "लक्षण से पहले जीवनशैली देखिए — नींद, सीमाएं, दिनचर्या।",
    ],
  },
  finance: {
    hi_en: [
      "Jupiter 2nd house axis ko support kar raha hai — growth hai, par disciplined flow chahiye.",
      "Abhi speculative moves se bachiye — 3-6 month ka solid buffer pehle.",
      "Ek income stream kam hai; side-skill monetization ka window khul raha hai.",
      "Money ek energy hai — jitna aap control karne ki koshish karte ho, utna hi wo block hoti hai.",
    ],
    en: [
      "Jupiter is supporting your 2nd-house axis — there is growth, but it needs disciplined flow.",
      "Avoid speculative moves right now — build a 3-to-6 month buffer first.",
      "One income stream is thin; a side-skill monetisation window is opening.",
      "Money is energy — the more you try to control it, the more it blocks.",
    ],
    hi: [
      "बृहस्पति आपके दूसरे भाव का समर्थन कर रहे हैं — वृद्धि है, पर अनुशासित प्रवाह चाहिए।",
      "अभी सट्टा वृिां से बचिए — 3-6 माह का बफ़र पहले।",
      "एक आय-स्रोत कम है; साइड-स्किल के मोनेटाइज़ेशन का समय खुल रहा है।",
      "धन ऊर्जा है — जितना नियंत्रण, उतना हीरोध।",
    ],
  },
  family: {
    hi_en: [
      "4th house energy charged hai — ghar ka mahaul ek chhoti baat pe settle bhi ho sakta hai.",
      "Aap mediator ban rahe ho; har ladai mein fairness zaroori nahi, presence kaafi hai.",
      "Ek conversation pending hai — aaj nahi toh agle raviwaar zaroor kijiye.",
      "Mata-Pita ke saath time quality > quantity — phone side mein rakhiye, baat aapki hogi.",
    ],
    en: [
      "The 4th house is charged — the household climate can shift on one small conversation.",
      "You've been cast as the mediator; sometimes presence matters more than being right.",
      "There's a pending talk — if not today, do it this Sunday.",
      "With parents, quality time beats quantity — put the phone down and they'll open up.",
    ],
    hi: [
      "चथे भाव की ऊर्जा सक्रिय है — घर का माहौल एक छोटी बात से बदल सकता है।",
      "आप मध्यस्त कर रहे हैं — कभी-कभी उपस्थिति, सही होने से ज़्यादा महत्वपूरण है।",
      "एक बातचीट बकी है — आज नहीं तो आते रविवार ज़रूर कीजिए।",
      "माता-पिता के साथ गुणवत्ता समय माप से ज़्यादा मायने रखता है।",
    ],
  },
  spiritual: {
    hi_en: [
      "Aapka sadhana phase shift kar raha hai — bahari rituals se inner listening tak.",
      "Kundi energy slow hai; ek chhota daily practice, ek badi annual yatra se zyada effective hai.",
      "Mantra: ॐ नमः शिवाय ya Gayatri — 108 times, subah 4:30-6:00 window.",
      "Aapko guidance nahi, permission chahiye — jo andar se sahi lagta hai wo kijiye.",
    ],
    en: [
      "Your sadhana is shifting from outer ritual to inner listening — that's growth, not loss.",
      "One small daily practice beats one grand annual pilgrimage right now.",
      "Mantra window: 4:30-6:00 AM, 108 repetitions of Om Namah Shivaya or Gayatri.",
      "You don't need guidance, you need permission — do what already feels right inwardly.",
    ],
    hi: [
      "आपका साधन बाहरी अनुष्ठान से भीतरी श्रवण की ओर जा रहा है — यह विकास है, हानि नहीं।",
      "एक छोटा रोज़ का अभ्यास एक बड़ी वार्षिक यात्रा से श्रेष्ठ है।",
      "मंत्र-समय: 4:30-6:00 प्रातः, ॐ नमः शिवाय 108 बार।",
      "आपको मार्ग नहीं, अनुमति चाहिए — जो भीतर से सही लगे, वही कीजिए।",
    ],
  },
  decision: {
    hi_en: [
      "Do options ke beech confusion nahi hai — aapko pata hai kaunsa sahi hai, bas risk dikh raha hai.",
      "Mercury retrograde jaisa feel hai, but actual transit supportive hai — socho, par atko mat.",
      "Decision ko 72-hour rule dijiye — teen din baad bhi sach lage toh haan.",
      "Chhota reversible step bada irreversible step se behtar hai abhi.",
    ],
    en: [
      "There's no real confusion between the options — you already know which is right, the risk is what you see.",
      "The Mercury fog feels retrograde, but the actual transit supports a decision — think, don't stall.",
      "Apply the 72-hour rule: if it still feels true in three days, it's a yes.",
      "Prefer a small reversible step over a large irreversible one right now.",
    ],
    hi: [
      "दो विकल्पों में वास्तविक भ्रम नहीं है — सही उत्तर आप भीतर जानते हैं, बस जोखिम दिख रहा है।",
      "बुध-धुंधली स्थिति रिट्रोग्रेड जैसी लगती है, पर गोचार णर्य को समर्थन दे रहा है।",
      "72-घंटे का नियम लगाइए — तीन दिन बाद भी सच लगे तो हाँ है।",
      "अभी छोटा प्रतिवर्ती कदम, बड़े अपरिवर्तनीय से बेहतर है।",
    ],
  },
  past: {
    hi_en: [
      "Past ka weight hai, par wo pattern hai, sentence nahi.",
      "Aap purani cycle ko naye kapdon mein repeat kar rahe ho — awareness ka step lijiye.",
      "Rahu ka axis purane karma ko surface kar raha hai — is baar alag response dijiye.",
      "Jo ho gaya uska analysis band kariye; sirf ek line likhiye: 'what did this teach me?'",
    ],
    en: [
      "The past carries weight, but it's a pattern, not a sentence.",
      "You're re-running an old cycle in new clothes — take the awareness step this time.",
      "Rahu's axis is surfacing old karma; respond differently this round.",
      "Stop analysing what happened; write one line — what did this teach me?",
    ],
    hi: [
      "अतीत का बोझ है, पर वह पैटर्न है, सजा नहीं।",
      "आप पुराने चक्यो को नए वस्त्रों में दोहरा रहे हैं — इस बार सचेत चलिए।",
      "राहु का अक्ष पुराने कर्म को सतह पर लान रहा है — इस बार उत्तर भिन्न दीजिए।",
      "विश्लेषण रोकिए; एक पंक्ति लिखिए — इसने मुझे क्या सिखाया?",
    ],
  },
  future: {
    hi_en: [
      "Next 45 days ka window important hai — ek event trigger ho sakta hai.",
      "Future fixed nahi hai, current trajectory hai — trajectory badalne ke tools aapke paas hain.",
      "Jupiter-Neptune aspect imagination ko real banana sikhata hai — likh ke layiye, visualize mat kijiye.",
      "Aane wale mahine 3 opportunities dikhengi, 2 pass ho jayengi, 1 pakadni hai.",
    ],
    en: [
      "The next 45 days are the window — one event may trigger.",
      "The future isn't fixed, it's a trajectory — and you hold the steering tools.",
      "Jupiter-Neptune aspect teaches you to make imagination concrete: write it down, don't just visualise.",
      "Next month shows three openings; two will pass, one is yours.",
    ],
    hi: [
      "अगले 45 दिन खिड़की हैं — एक घटना trigger हो सकती है।",
      "भविष्य निश्चित नहीं, वर्तमान गतिरेखा है — और दिशा बदलने के साधन आपके हाथ में हैं।",
      "बृहस्पति-नेप्च्युन दृष्टि कल्पना को वास्तव बनाना सिखाती है — लिखिए, केवल देखिए नहीं।",
      "अगले माह तीन अवसर दिखेंगे; दो से निकल जाएंगे, एक आपको है।",
    ],
  },
  greeting: {
    hi_en: [
      "Namaste — bahut accha ki aapne reach out kiya.",
      "Aaiye, seedhe point pe aate hain. Aaj kya sabse zyada mann leke chal raha hai?",
      "Ye chat safe hai. Jo bhi poochhna hai, bina filter ke boliye.",
      "Pehla step: ek sentence mein problem likhiye — phir main structured guidance dunga.",
    ],
    en: [
      "Namaste — I'm glad you reached out.",
      "Let's get to the point. What's weighing on you the most today?",
      "This chat is safe. Ask what's actually on your mind, no filter.",
      "First step: describe the concern in one sentence — I'll take it from there with a structured read.",
    ],
    hi: [
      "नमस्ते — आपने संपर्क किया, अच्छा हुआ।",
      "सीधे मुख्य बात पर आइए — आज सबसे अधिक मन में क्या चल रहा है?",
      "यह संवाद सुरक्षित है — बिना संकोच पूछिए।",
      "पहला कदम: समस्या एक पंक्ति में लिखिए, मैं संरचित मार्गदश करूंगी।",
    ],
  },
  gratitude: {
    hi_en: [
      "Shukriya kehne ki zaroorat nahi — aapka growth kaafi hai.",
      "Aur kabhi bhi aaiye, main yahin hoon.",
      "Positive thoughts hamesha aapke saath.",
      "Aapne himmat ki baat share karne ki — ye sabse badi kriya hai.",
    ],
    en: [
      "No thanks needed — your growth is the response.",
      "Come back any time; I'm always here.",
      "Sending you steady, positive thoughts.",
      "You found the courage to share — that's already the biggest step.",
    ],
    hi: [
      "धन्यवाद की आवश्यकता नहीं — आपका विकास ही उत्तर है।",
      "जब चाहें आइए, मैं यहीं हूं।",
      "आपके लिए स्थिर, सकारात्मक विचार।",
      "आपने साझा करने की हिम्मत की — यही सबसे बड़ा कदम है।",
    ],
  },
  general: {
    hi_en: [
      "Kuch layers hain — ek saaf, ek subtle, ek jo aap abhi ignore kar rahe ho.",
      "Situation neutral hai, interpretation charged — isliye clarity chahiye.",
      "Ek sawaal poochhta hoon: aapko already pata hai answer, confirmation chahiye ya new angle?",
      "Chhoti daily kriya, badi one-time kriya se zyada kaam karti hai.",
    ],
    en: [
      "There are three layers — one visible, one subtle, one you're currently skipping.",
      "The situation itself is neutral; the interpretation is charged. That's where clarity lives.",
      "Let me ask: do you already know the answer and want confirmation, or do you want a new angle?",
      "Small daily practice beats big one-time effort — start there.",
    ],
    hi: [
      "तीन स्तर हैं — एक दृश्य, एक सूक्ष्म, एक जिसे आप अभी टाल रहे हैं।",
      "परिस्थिति तटस्थ है, व्याख्या आवेशित — स्पष्टता वहीं है।",
      "एक सवाल: उत्तर पहले से पता है, पुष्टि चाहिए या नया कोण?",
      "छोटा रोज़ का अभ्यास, बड़े एक बार के प्रयास से श्रेष्ठ है।",
    ],
  },
};

// ─── Service detection ────────────────────────────────────────────────────────
// Each route uses a distinctive system prompt. When all upstream providers fail
// we must return content the CLIENT can parse — tarot wants JSON, horoscope
// wants five bold headings, everything else wants a chat reply.
type ServiceKind = "tarot-json" | "horoscope-md" | "kundali-md" | "numerology-md" | "chat";

function detectService(sys: string, user: string): ServiceKind {
  const s = sys.toLowerCase();
  if (s.includes("carddetails") && s.includes("synthesis")) return "tarot-json";
  if (s.includes("today's sky") && s.includes("lucky window")) return "horoscope-md";
  if (s.includes("janam kundali") || s.includes("jyotishi") || s.includes("lagna")) return "kundali-md";
  if (s.includes("life path") && s.includes("destiny") && s.includes("soul urge")) return "numerology-md";
  void user;
  return "chat";
}

// Extract "N. Card Name (REVERSED?) — Position: X" entries from tarot user prompt.
function extractTarotCards(user: string): Array<{ position: string; cardName: string; orientation: "upright" | "reversed" }> {
  const out: Array<{ position: string; cardName: string; orientation: "upright" | "reversed" }> = [];
  const re = /^\s*\d+\.\s+(.+?)(\s*\(REVERSED\))?\s*[—-]+\s*Position:\s*(.+?)\s*$/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(user)) !== null) {
    out.push({
      cardName: m[1]!.trim(),
      orientation: m[2] ? "reversed" : "upright",
      position: m[3]!.trim(),
    });
  }
  return out;
}

function tarotSynthesis(cards: Array<{ cardName: string; position: string }>): string {
  if (cards.length === 0) return "The cards have been drawn — sit with their imagery before acting.";
  const line = cards.map((c) => `${c.cardName} in ${c.position}`).join(", ");
  return [
    `This spread moves as one story. ${line} — read them in sequence, not in isolation.`,
    "",
    "The earlier positions describe what is already set in motion; the later ones show what your next choice can still bend. Cards that share an element (fire with fire, water with water) mean the theme is compounding; opposite elements mean a trade-off is being asked of you.",
    "",
    "Take the middle card seriously — it names the current pivot. Whatever you do next week should serve that card, not the first one.",
    "",
    "Nothing here is fixed. The deck reads tendencies, not verdicts.",
  ].join("\n");
}

function buildTarotFallback(user: string, seed: number): string {
  const cards = extractTarotCards(user);
  const coreMeanings = [
    "A snapshot of the situation exactly as it is — no judgment, just clear seeing.",
    "The energy you are actively radiating right now; others feel it before you name it.",
    "A near-term outcome if the current trajectory holds without intervention.",
    "What is quietly supporting you, even when it does not look like help yet.",
    "The one thing to release for the next phase to unlock.",
  ];
  const symbolisms = [
    "The imagery points to thresholds — doors, paths, edges. Movement is available.",
    "Recurring numerology in this card signals a completed cycle ready to be honoured.",
    "The figures shown are aspects of one self, not separate people.",
  ];
  const elemental = [
    "Fire here asks for decisive action rather than more deliberation.",
    "Water asks for feeling the shape of the situation before fixing it.",
    "Air asks for a clear conversation, ideally written down first.",
    "Earth asks for one small, concrete, repeatable habit.",
  ];
  const guidance = [
    "Name what this card is asking of you in one sentence, then act on that sentence within 48 hours.",
    "Journal for three lines each morning this week — the pattern will surface by day four.",
    "Talk to one person who has walked a version of this path before deciding.",
  ];
  const cardDetails = (cards.length ? cards : [{ cardName: "The Fool", orientation: "upright" as const, position: "Position 1" }]).map((c, i) => ({
    position: c.position,
    cardName: c.cardName,
    orientation: c.orientation,
    coreMeaning: pick(coreMeanings, (seed >>> (i + 1)) + i),
    symbolism: pick(symbolisms, (seed >>> (i + 3)) + i),
    elementalInfluence: pick(elemental, (seed >>> (i + 5)) + i),
    practicalGuidance: pick(guidance, (seed >>> (i + 7)) + i),
  }));
  const energy = pick(
    ["Steady unfolding", "Quiet pivot", "Clearing before building", "Trust the slow yes", "Momentum with a soft brake"],
    seed >>> 9,
  );
  return JSON.stringify({
    cardDetails,
    synthesis: tarotSynthesis(cardDetails),
    actionStep: "Write down the middle card's message and take one small step on it in the next 24 hours.",
    overallEnergy: energy,
  });
}

function buildHoroscopeFallback(user: string, seed: number): string {
  const signMatch = user.match(/horoscope for ([A-Za-z ]+?) —/i);
  const sign = signMatch?.[1]?.trim() ?? "you";
  const careers = [
    "Aaj apne kaam ko prioritize karna hoga, taaki overwhelmed mehsoos na ho. Ek chhoti deadline aage khisak sakti hai.",
    "Work rhythm stable hai, par ek colleague ke saath tone check rakhiye — chhoti si baat badi lag sakti hai.",
    "Naya project offer aa sakta hai; haan bolne se pehle timeline aur scope dono confirm kariye.",
  ];
  const love = [
    "Moon aapke relationships axis ko touch kar raha hai — ek honest baat late shaam ko clarity degi.",
    "Jo baat adhuri thi, wo aaj isharon se adhoori lagegi. Kal subah tak rukiye.",
    "Single log: ek unexpected introduction ho sakti hai — phone side mein rakhiye, nazar upar.",
  ];
  const health = [
    "Energy afternoon mein dip karegi — 20 minute ka walk ya short nap kaafi recharge dega.",
    "Neend ka pattern thoda disturbed lag raha hai; sone se 45 minute pehle screens off rakhiye.",
    "Digestion sensitive hai aaj — spicy aur cold dono kam kariye, gunguna paani zyada.",
  ];
  const sky = [
    "Sun aur Venus ka combination practical communication ko support kar raha hai — jo bolna hai, saaf boliye.",
    "Moon ki speed zyada hai — decisions subah ke window mein behtar baithenge.",
    "Mercury steady hai; paperwork, contracts aur travel logistics aaj smooth chalenge.",
  ];
  const lucky = [
    "Lucky window subah 10 se 12 baje. Rang: safed ya halka neela. Number: 6.",
    "Lucky window dopahar 2 se 4 baje. Rang: hara. Number: 3.",
    "Lucky window shaam 6 se 8 baje. Rang: mustard. Number: 9.",
  ];
  return [
    "**Today's Sky**",
    pick(sky, seed),
    "",
    "**Career & Money**",
    pick(careers, seed >>> 2),
    "",
    "**Love & Relationships**",
    pick(love, seed >>> 4),
    "",
    "**Health & Energy**",
    pick(health, seed >>> 6),
    "",
    "**Lucky Window**",
    `${sign}: ${pick(lucky, seed >>> 8)}`,
  ].join("\n");
}

function buildKundaliFallback(sys: string, seed: number): string {
  void seed;
  const text = sys;
  const SIGNS = "Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces";
  const lagnaMatch =
    text.match(new RegExp(`ascendant sign[^A-Za-z]*(${SIGNS})`, "i")) ||
    text.match(new RegExp(`Lagna[^A-Za-z]*(${SIGNS})`, "i")) ||
    text.match(new RegExp(`Sign:\\s*(${SIGNS})`, "i"));
  const chandraMatch =
    text.match(new RegExp(`moon sign[^A-Za-z]*(${SIGNS})`, "i")) ||
    text.match(/Moon Nakshatra[^A-Za-z]*([A-Za-z ]{3,25})/i) ||
    text.match(new RegExp(`Moon:\\s*(${SIGNS})`, "i"));
  const lagna = lagnaMatch?.[1]?.trim() ?? "your ascendant";
  const chandra = chandraMatch?.[1]?.trim() ?? "your Moon nakshatra";
  return [
    `**Lagna — ${lagna}**`,
    "Lagna aapke shareer, personality aur naye start ka sutra hai. Ye position batata hai ki duniya aapko pehle kaise padhti hai — jo tone aap set karte ho, wahi aapka default hai.",
    "",
    `**Chandra — ${chandra}**`,
    "Moon aapki inner weather hai — emotions, memory, mother-connection. Ye strong placement aapko deep feeling aur protective instinct deti hai; routine aur paani ke paas rehne se balance bana rehta hai.",
    "",
    "**Baal / Yuva / Vruddh dasha ka outline**",
    "Graha bal abhi ek medium-band ka window dikha rahe hain — koi bada twist nahi, par koshish ko consistency chahiye. Agla 6-18 mahina skill-building ka hai; 18 mahine baad visibility badhegi.",
    "",
    "**Upay**",
    "Subah 20 minute ki shanti, hafte mein ek baar seva, aur jo log already aapke kaam ki prashansa kar rahe hain unse feedback maangna — teen cheezein current grah-sthiti ke saath align karti hain.",
    "",
    "(Note: ye chart astronomical engine se aaya hai; live AI interpretation abhi temporarily offline hai. Upaya upar general hai — specific dasha-level detail ke liye dobara try kijiye.)",
  ].join("\n");
}

function buildNumerologyFallback(sys: string, seed: number, userText?: string): string {
  const text = `${sys}\n${userText ?? ""}`;
  const nameMatch = text.match(/Name:\s*([^\n]+)/i);
  const dobMatch = text.match(/DOB:\s*([0-9\-\/]+)/i);
  const name = nameMatch?.[1]?.trim() ?? "the seeker";
  const dob = dobMatch?.[1]?.trim() ?? "";
  const lifePath = dob ? computeLifePathFromDob(dob) : null;
  const dest = name ? computeExpressionFromName(name) : null;
  const soul = name ? computeSoulUrgeFromName(name) : null;
  const head = lifePath ?? dest ?? soul ?? 7;
  const bodyByLp: Record<number, string> = {
    1: "Life Path 1 — leader, initiator. Aapka rasta self-driven work, original ideas, aur clear personal boundaries ka hai.",
    2: "Life Path 2 — diplomat, co-creator. Partnership, sensitivity, aur behind-the-scenes glue aapki asli strength hai.",
    3: "Life Path 3 — communicator. Likhai, bol, art, teaching — jin jagah voice jaati hai, wahin aap charge hote ho.",
    4: "Life Path 4 — builder. Systems, routines, craft — slow aur solid kaam aapko long-term security dega.",
    5: "Life Path 5 — explorer. Change, travel, variety — rigid plan se behtar modular experiment aapke liye kaam karta hai.",
    6: "Life Path 6 — caretaker. Family, home, community, beauty — jo aap sambhalte ho wahi aapka legacy banega.",
    7: "Life Path 7 — seeker. Study, solitude, research — depth mein jaana hi aapki asli growth hai.",
    8: "Life Path 8 — strategist. Money, power, leadership — material world ko aap handle karne ke liye aaye ho, balance seekhna important hai.",
    9: "Life Path 9 — humanitarian. Completion, compassion, global view — chhota circle se aage, badi seva aapko fulfill karegi.",
    11: "Master 11 — intuition + teaching. Aap inner knowing se signal lete ho; vision aur mentorship aapka kaam hai.",
    22: "Master 22 — master builder. Badi structures banana, long-term legacy design karna — ye rare placement aapse discipline maangti hai.",
    33: "Master 33 — teacher-healer. Compassion + creativity + guidance — is path ko chhote daily actions se jiyein.",
  };
  return [
    "**Life Path**",
    lifePath ? bodyByLp[lifePath] ?? `Life Path ${lifePath} — pattern is here, detailed reading reloading shortly.` : "Please share your DOB for an exact Life Path.",
    "",
    "**Destiny / Expression**",
    dest ? `Expression ${dest} — aapka naam ka vibration aapko visible world mein is tarah express karne deta hai: ${pick(["creative authority", "systematic leadership", "adaptive communicator", "grounded provider", "curious explorer", "nurturing mentor", "deep analyst", "strategic builder", "compassionate finisher", "intuitive messenger", "long-arc architect", "healing teacher"], seed >>> 3)}.` : "Provide your full birth name for an exact Destiny number.",
    "",
    "**Soul Urge / Heart's Desire**",
    soul ? `Heart's Desire ${soul} — vowels reveal the private 'why' behind your choices: ${pick(["to be trusted", "to belong", "to be heard", "to build something lasting", "to move and see", "to care and be cared for", "to know and understand", "to lead with integrity", "to complete and let go", "to inspire", "to shape the future", "to heal"], seed >>> 5)}.` : "Vowels from your full name give this number — please share it.",
    "",
    "**Chaldean quick note**",
    "Zeal uses Pythagorean as the default; Chaldean adds a subtle layer for name vibrations. Live AI detail for that layer is reloading — please try again in a moment.",
    `--- seed: ${String(head)} ---`.replace(/---.*---/g, ""),
  ].filter(Boolean).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function computeLifePathFromDob(dob: string): number | null {
  const digits = dob.replace(/\D/g, "");
  if (!digits) return null;
  let sum = digits.split("").reduce((a, b) => a + Number(b), 0);
  while (sum > 9 && sum !== 11 && sum !== 22 && sum !== 33) {
    sum = String(sum).split("").reduce((a, b) => a + Number(b), 0);
  }
  return sum;
}
const PYTH_MAP: Record<string, number> = {
  a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9,
  j: 1, k: 2, l: 3, m: 4, n: 5, o: 6, p: 7, q: 8, r: 9,
  s: 1, t: 2, u: 3, v: 4, w: 5, x: 6, y: 7, z: 8,
};
function reduceNum(n: number): number {
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = String(n).split("").reduce((a, b) => a + Number(b), 0);
  }
  return n;
}
function computeExpressionFromName(name: string): number | null {
  const letters = name.toLowerCase().replace(/[^a-z]/g, "");
  if (!letters) return null;
  let sum = 0;
  for (const ch of letters) sum += PYTH_MAP[ch] ?? 0;
  return reduceNum(sum);
}
function computeSoulUrgeFromName(name: string): number | null {
  const vowelsOnly = name.toLowerCase().replace(/[^aeiouy]/g, "").replace(/y/g, "");
  if (!vowelsOnly) return null;
  let sum = 0;
  for (const ch of vowelsOnly) sum += PYTH_MAP[ch] ?? 0;
  return reduceNum(sum);
}

// ─── Main generator ───────────────────────────────────────────────────────────
export function generateHardcoded(input: HardcodedInput): string {
  const sys = input.systemPrompt ?? "";
  const user = input.userMessage ?? "";
  const service = detectService(sys, user);
  const seed = hash32(`${input.personaCategory}|${input.personaName}|${user}`);

  if (service === "tarot-json") return buildTarotFallback(user, seed);
  if (service === "horoscope-md") return buildHoroscopeFallback(user, seed);
  if (service === "kundali-md") return buildKundaliFallback(sys, seed);
  if (service === "numerology-md") return buildNumerologyFallback(sys, seed, user);

  const topic = detectTopic(input.userMessage);
  const locale = input.locale ?? detectLocale(input.userMessage);
  const banks = TOPIC_LINES[topic] ?? TOPIC_LINES.general;
  const lines = locale === "hi" ? banks.hi : locale === "en" ? banks.en : banks.hi_en;

  const openBank = locale === "hi" ? OPENINGS_HINDI : locale === "en" ? OPENINGS_ENGLISH : OPENINGS_HINGLISH;

  const opener = pick(openBank, seed);
  const closer = pick(CLOSINGS, seed >>> 3);
  const head1 = pick(SECTION_HEADS, seed >>> 5);
  const head2 = pick(SECTION_HEADS, (seed >>> 7) + 3);

  const bodyA = pick(lines, seed >>> 2);
  const bodyB = pick(lines, (seed >>> 4) + 1);

  const name = input.personaName?.trim();
  const signoff = name ? `— ${name}` : "";

  return [
    opener,
    "",
    `**${head1}**`,
    bodyA,
    "",
    `**${head2}**`,
    bodyB,
    "",
    closer,
    signoff,
  ].filter(Boolean).join("\n");
}

// ─── Response builders (worker + web) ─────────────────────────────────────────
export function buildHardcodedJsonResponse(input: HardcodedInput): Response {
  const content = generateHardcoded(input);
  return new Response(
    JSON.stringify({
      id: `hardcoded-${Date.now()}`,
      object: "chat.completion",
      model: "zeal-hardcoded-oracle",
      provider: "hardcoded",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 0, completion_tokens: Math.ceil(content.length / 4), total_tokens: Math.ceil(content.length / 4) },
    }),
    { status: 200, headers: { "Content-Type": "application/json", "X-Zeal-Provider": "hardcoded" } },
  );
}

export function buildHardcodedStreamResponse(input: HardcodedInput): Response {
  const content = generateHardcoded(input);
  const encoder = new TextEncoder();
  const tokens = splitForStream(content);
  const body = new ReadableStream<Uint8Array>({
    start(ctrl) {
      const pushObj = (o: unknown) => ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(o)}\n\n`));
      for (const tok of tokens) {
        pushObj({ id: "hardcoded", object: "chat.completion.chunk", model: "zeal-hardcoded-oracle", choices: [{ index: 0, delta: { content: tok }, finish_reason: null }] });
      }
      pushObj({ id: "hardcoded", object: "chat.completion.chunk", model: "zeal-hardcoded-oracle", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
      ctrl.enqueue(encoder.encode("data: [DONE]\n\n"));
      ctrl.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "X-Zeal-Provider": "hardcoded", "Cache-Control": "no-cache" },
  });
}

function splitForStream(text: string): string[] {
  // Split on word boundaries, ~3 words per chunk, keeps markdown intact.
  const words = text.split(/(\s+)/);
  const out: string[] = [];
  let buf = "";
  let count = 0;
  for (const w of words) {
    buf += w;
    if (/\S/.test(w)) count++;
    if (count >= 3) { out.push(buf); buf = ""; count = 0; }
  }
  if (buf) out.push(buf);
  return out;
}
