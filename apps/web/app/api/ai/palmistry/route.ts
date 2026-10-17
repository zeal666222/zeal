import { createServerClientFromCookies } from "@zeal/database/server";
import { checkRateLimit, aiRateLimiter } from "@/lib/rate-limit";
import { generateFaultTolerantStream } from "@/lib/ai/router";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });

  const rl = await checkRateLimit(aiRateLimiter, `palmistry:${user.id}`);
  if (!rl.ok) return new Response("Please wait a moment, then try again.", { status: 429, headers: rl.headers });

  try {
    const body = await req.json();
    const {
      handSide = "right",
      primaryFocus = "general",
      analysis,
    } = body as {
      handSide?: string;
      primaryFocus?: string;
      analysis?: {
        handShape?: { element: string; fingerRatio: number; dominantFingerShape: string; confidence: number };
        lines?: Record<string, { present: boolean; quality: string; length: string; curvature: string; depth: number; branches: number; breaks: number; chains: boolean; forks: number; islands: boolean; score: number }>;
        mounts?: Array<{ name: string; development: string; score: number }>;
        dominantTraits?: string[];
        overallScore?: number;
      };
    };

    const focusMap: Record<string, string> = {
      general: "comprehensive life overview covering all major areas",
      love: "love, relationships, emotional bonds, and partnership dynamics",
      career: "career trajectory, ambition, professional destiny, and life purpose",
      health: "health constitution, vitality patterns, and physical well-being",
      spiritual: "spiritual evolution, inner development, and psychic gifts",
      finance: "wealth potential, prosperity patterns, and material success",
    };

    const focus = focusMap[primaryFocus] ?? focusMap.general;

    let analysisContext = "";
    if (analysis) {
      const hs = analysis.handShape;
      const lines = analysis.lines ?? {};
      const mounts = analysis.mounts ?? [];

      const elementTraits: Record<string, string> = {
        fire: "passionate leader, action-oriented, charismatic, impulsive",
        earth: "grounded builder, practical, patient, sensual, reliable",
        air: "intellectual communicator, analytical, adaptive, curious",
        water: "intuitive empath, deeply feeling, artistic, psychic sensitivity",
      };

      const fingerShapeTraits: Record<string, string> = {
        square: "methodical, precise, practical problem-solver",
        conic: "artistic, creative, aesthetic sensitivity",
        spatulate: "entrepreneurial, active creativity, original thinker",
        pointed: "philosophical, spiritual, idealistic, psychic",
      };

      analysisContext = `\n\n═══════════════════════════════════════════════════
COMPUTER VISION ANALYSIS DATA (from digital palm scan)
═══════════════════════════════════════════════════

HAND CLASSIFICATION:
• Element: ${(hs?.element ?? "unknown").toUpperCase()} — ${elementTraits[hs?.element ?? ""] ?? "balanced blend of elements"}
• Finger-to-Palm Ratio: ${hs?.fingerRatio ?? "N/A"} — ${((hs?.fingerRatio ?? 0) > 1.2 ? "exceptional attention to detail, meticulous thinker" : (hs?.fingerRatio ?? 0) > 1 ? "thorough yet decisive, balanced processing" : (hs?.fingerRatio ?? 0) > 0.85 ? "fluid thinker, adapts between detail and big picture" : "rapid decision-maker, instinct-driven")}
• Finger Shape: ${hs?.dominantFingerShape ?? "unknown"} — ${fingerShapeTraits[hs?.dominantFingerShape ?? ""] ?? "mixed characteristics"}
• Classification Confidence: ${hs?.confidence ? Math.round(hs.confidence * 100) + "%" : "N/A"}

MAJOR LINES ANALYSIS (scored 0-100):
${Object.entries(lines).map(([name, l]) => {
  const grade = l.score >= 80 ? "EXCEPTIONAL" : l.score >= 60 ? "STRONG" : l.score >= 40 ? "MODERATE" : l.score >= 20 ? "SUBTLE" : "ABSENT";
  return `
▸ ${name.toUpperCase()} LINE [${grade} — ${l.score}/100]
  Quality: ${l.present ? l.quality : "absent"} | Extent: ${l.length} | Pattern: ${l.curvature.replace("_", " ")}
  Depth: ${Math.round((l.depth ?? 0) * 100)}% | Branches: ${l.branches} | Breaks: ${l.breaks}
  Special: ${[l.chains ? "chains" : "", l.forks > 0 ? `${l.forks} forks` : "", l.islands ? "islands" : ""].filter(Boolean).join(", ") || "none"}`;
}).join("\n")}

MOUNT DEVELOPMENT (energy centers):
${mounts.filter((m) => m.score > 20).sort((a, b) => b.score - a.score).map((m) =>
  `• ${m.name}: ${m.development.replace("_", " ").toUpperCase()} (${m.score}/100)`
).join("\n")}

DOMINANT TRAITS DETECTED: ${(analysis.dominantTraits ?? []).join(", ") || "balanced profile"}
OVERALL PALM CLARITY SCORE: ${analysis.overallScore ?? 0}/100
═══════════════════════════════════════════════════`;
    }

    const systemPrompt = `You are Zeal's Master Palmist — one of the world's foremost chiromancers, combining 35+ years of practice across three great palmistry traditions:

YOUR KNOWLEDGE FOUNDATIONS:
• Vedic Hasta Samudrika Shastra — the ancient Indian science of hand reading, emphasizing mount development and line depth
• Western Chiromancy — the European tradition formalized by Cheiro, focusing on line quality, branches, and formations
• Chinese Hand Reading (Shou Xiang) — emphasizing hand shape, finger proportions, and palm texture

YOUR EXPERTISE LEVEL:
• You have read over 50,000 palms across 30+ countries
• You understand the statistical distribution of line patterns and what rare formations mean
• You can identify subtle connections between lines that most palmists miss
• You combine palmistry with knowledge of anatomy, psychology, and behavioral patterns

READING METHODOLOGY:
For each line and feature, you apply a grading framework:
- Score 80-100 (EXCEPTIONAL): This quality is central to the person's identity and life path
- Score 60-79 (STRONG): Well-developed capacity that actively shapes daily life
- Score 40-59 (MODERATE): Present but developing — grows with conscious attention
- Score 20-39 (SUBTLE): Latent potential expressed through unconventional channels
- Score 0-19 (ABSENT): Not a primary life theme — energy flows through other features

CROSS-REFERENCING PROTOCOL:
You NEVER read lines in isolation. You always note:
- Heart + Head combination: How emotion and intellect interact
- Life + Fate combination: Whether vitality aligns with purpose
- Sun + Fate combination: Whether career leads to recognition
- Mount patterns that reinforce or contradict line readings
- Hand element that colors ALL other features

YOUR COMMUNICATION STYLE:
• Open with a vivid, personalized observation that makes the user feel SEEN
• Use sensory metaphors: "Your heart line sweeps like a river delta..." not "Your heart line is curved"
• Reference specific data: "With your heart line scoring 78/100 and your head line at 62/100..."
• Address the user directly: "You", "Your", "Your palm reveals..."
• Balance strengths with growth areas — never purely flattering, never critical
• Every challenge you mention comes with a practical path forward
• End each section with an empowering insight

READING STRUCTURE (follow this exactly):
1. OPENING (2-3 sentences) — A striking, personalized observation that demonstrates you've truly read their palm
2. HAND ELEMENT — What their elemental type reveals about core nature, with finger shape nuance
3. MAJOR LINES — Heart, Head, Life, Fate in depth. For each: what it reveals, specific observations from the data, how it interacts with other lines
4. SECONDARY LINES — Sun, Marriage (if detected with score > 20)
5. MOUNT HIGHLIGHTS — 3-4 most significant mounts and their implications
6. FOCUS DEEP DIVE — Extended analysis of their chosen focus area (${focus}), drawing on ALL relevant features
7. SYNTHESIS & GUIDANCE — Tie everything together into a cohesive life narrative with forward-looking empowerment

CRITICAL RULES:
• NEVER predict death, disasters, or fixed negative outcomes
• NEVER claim absolute certainty — use "suggests", "indicates", "reveals a tendency"
• ALWAYS empower — every reading ends with the user feeling capable and directed
• Reference the analysis data explicitly — scores, qualities, patterns — to make it feel personal and accurate
• Be specific, not generic — "Your heart line's 3 branches suggest emotional energy radiating into family, career, and creative expression" not "You have branches on your heart line"
• Use the hand side context: ${handSide === "right" ? "Right hand = present path and developed potential (active reading)" : "Left hand = innate gifts and birth potential (potential reading)"}
${analysisContext}`;

    const userPrompt = `Please provide my complete, in-depth palm reading.

My ${handSide} hand has been digitally analyzed (data above). My primary focus is: ${focus}.

I want you to go DEEP — not surface-level observations. For each major feature:
- What it specifically reveals about me (reference the exact scores and patterns)
- How it interacts with other features on my palm
- What this means for my daily life and long-term path
- Practical guidance for working with this energy

Give me a reading that feels like I'm sitting across from a master palmist who has truly studied my hand.`;

    const stream = await generateFaultTolerantStream(systemPrompt, userPrompt);
    const headers = new Headers(stream.headers);
    for (const [k, v] of Object.entries(rl.headers ?? {})) headers.set(k, v);
    return new Response(stream.body, { status: stream.status, headers });
  } catch {
    return NextResponse.json({ error: "Palmistry reading is taking a brief pause — please try again shortly." }, { status: 500 });
  }
}
