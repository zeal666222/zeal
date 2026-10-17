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

  const rl = await checkRateLimit(aiRateLimiter, `dream:${user.id}`);
  if (!rl.ok) return new Response("Please wait a moment, then try again.", { status: 429, headers: rl.headers });

  try {
    const body = await req.json();
    const {
      dreamText = "",
      dreamFocus = "general",
      emotions = "",
      recurringDream = false,
      lucidElements = "",
      analysis,
    } = body as {
      dreamText?: string;
      dreamFocus?: string;
      emotions?: string;
      recurringDream?: boolean;
      lucidElements?: string;
      analysis?: {
        symbols?: Array<{ symbol: string; category: string }>;
        themes?: Array<{ theme: string; intensity: number; variations: string[] }>;
        archetypes?: Array<{ archetype: string; presence: number; manifestations: string[] }>;
        emotions?: Array<{ emotion: string; intensity: number; triggers: string[] }>;
        lucidityIndicators?: number;
        recurrenceIndicators?: number;
        overallInsight?: string;
      };
    };

    const focusMap: Record<string, string> = {
      general: "comprehensive dream interpretation covering all dimensions",
      psychological: "Jungian psychological analysis — shadow, persona, individuation",
      spiritual: "spiritual and transpersonal meaning — soul-level messaging",
      emotional: "emotional healing and processing — what feelings need attention",
      guidance: "practical life guidance — what the dream advises for waking life",
      creative: "creative inspiration — artistic and imaginative dimensions",
    };

    const focus = focusMap[dreamFocus] ?? focusMap.general;

    let analysisContext = "";
    if (analysis) {
      const symbols = analysis.symbols ?? [];
      const themes = analysis.themes ?? [];
      const archetypes = analysis.archetypes ?? [];
      const emotions = analysis.emotions ?? [];

      analysisContext = `\n\nCOMPUTATIONAL DREAM ANALYSIS DATA:
SYMBOLS DETECTED:
${symbols.map((s) => `- ${s.symbol} (${s.category})`).join("\n") || "No strong symbols detected"}

THEMES IDENTIFIED:
${themes.map((t) => `- ${t.theme.replace("_", " ").toUpperCase()} (intensity: ${Math.round(t.intensity * 100)}%): ${t.variations.join(", ")}`).join("\n") || "No dominant themes"}

ARCHETYPES ACTIVE:
${archetypes.map((a) => `- ${a.archetype.replace("_", " ").toUpperCase()} (presence: ${Math.round(a.presence * 100)}%): manifests as ${a.manifestations.join(", ")}`).join("\n") || "No strong archetypal patterns"}

EMOTIONAL TONE:
${emotions.map((e) => `- ${e.emotion.toUpperCase()} (intensity: ${Math.round(e.intensity * 100)}%): triggered by ${e.triggers.join(", ")}`).join("\n") || "Emotional tone not clearly detected"}

SPECIAL FEATURES:
- Lucidity indicators: ${analysis.lucidityIndicators ? `${Math.round(analysis.lucidityIndicators * 100)}%` : "none"}
- Recurrence indicators: ${analysis.recurrenceIndicators ? `${Math.round(analysis.recurrenceIndicators * 100)}%` : "none"}
- Overall insight: ${analysis.overallInsight ?? "N/A"}`;
    }

    const systemPrompt = `You are Zeal's Master Dream Interpreter — a world-class oneirologist with 30+ years of practice combining Jungian depth psychology, Gestalt dream work, cognitive dream theory, and transpersonal psychology.

YOUR EXPERTISE:
- You interpret dreams with the precision of a clinical psychologist and the warmth of a trusted guide
- You draw from Jungian archetypes, Freudian symbolism (tastefully), Gestalt dialogue techniques, and modern neuroscience
- You never predict the future or claim literal meanings — you reveal the psyche's symbolic language
- You treat every dream as sacred — the unconscious mind's nightly letter to the conscious self
- You reference specific symbols, themes, and emotions from the analysis data to make interpretations feel personal and accurate

YOUR STYLE:
- Warm, insightful, gently mystical yet grounded in psychology
- Use vivid metaphors: "Your dream weaves a tapestry of..." not "Your dream means..."
- Address the user directly with "you" and "your"
- Structure your interpretation with clear sections
- End with practical integration steps — what to DO with the dream's message
- Never say "this means you will..." — always frame as "this suggests..." or "your psyche may be..."

INTERPRETATION STRUCTURE:
1. Opening — acknowledge the dream's atmosphere and set a contemplative tone (2-3 sentences)
2. Narrative Thread — weave the dream's story into a coherent psychological narrative
3. Symbol Analysis — interpret each major symbol with Jungian depth
4. Theme Exploration — explore the dominant themes and what they reveal about current life dynamics
5. Archetypal Layer — identify which archetypes are at work and what they're asking of the dreamer
6. Emotional Core — honor the dream's emotional tone and what it reveals about inner state
7. Focus Area — deep dive into their chosen focus (${focus})
8. Integration — practical steps for working with the dream in waking life
9. Empowering Close — synthesis and forward-looking guidance

IMPORTANT: Reference the specific analysis data provided. Mention symbols, themes, archetypes, and emotions explicitly. This makes the interpretation feel personalized and accurate.

${recurringDream ? "NOTE: This appears to be a recurring dream. Recurring dreams are the psyche's persistent message — emphasize what unresolved issue the dream may be highlighting and what action the dreamer might take to resolve it." : ""}
${lucidElements ? `NOTE: The dreamer reports lucid elements: "${lucidElements}". Explore what this awareness within the dream might signify about their level of consciousness and self-awareness.` : ""}
${emotions ? `NOTE: The dreamer reports these waking emotions connected to the dream: "${emotions}". Use this to deepen the emotional interpretation.` : ""}${analysisContext}`;

    const userPrompt = `Please provide my complete dream interpretation. Here is my dream:

"${dreamText}"

My primary focus is: ${focus}. Give me a deep, insightful interpretation that combines all the analysis data into a cohesive, empowering narrative. Help me understand what my unconscious is communicating and how I can integrate this wisdom into my waking life.`;

    const stream = await generateFaultTolerantStream(systemPrompt, userPrompt);
    const headers = new Headers(stream.headers);
    for (const [k, v] of Object.entries(rl.headers ?? {})) headers.set(k, v);
    return new Response(stream.body, { status: stream.status, headers });
  } catch {
    return NextResponse.json({ error: "Dream interpretation is momentarily paused — please try again in a moment." }, { status: 500 });
  }
}
