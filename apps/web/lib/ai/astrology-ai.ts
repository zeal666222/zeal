// ============================================================================
// Astrology AI Service
// ============================================================================
// Orchestrates: chart computation → RAG retrieval → LLM interpretation
// Reuses the existing AI engine (Groq free tier) for LLM calls.
// ============================================================================

import { callAI, callAIJson, AIUnavailableError } from "@/lib/ai/engine";
import { retrieveKnowledge, generateRuleBasedInterpretations, type ChartDataForRAG } from "@/lib/ai/astrology-rag";
import {
  getVedicChart,
  getWesternChart,
  getChineseChart,
  getDasha,
  getTransits,
} from "@/lib/astrology/client";
import type { BirthData, NatalChart, WesternNatalChart, FourPillars, VimshottariDasha } from "@zeal/astrology";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChartType = "vedic" | "western" | "chinese";

export interface AstrologyInterpretRequest {
  birthDate: string;
  birthTime: string;
  birthPlace: { lat: number; lng: number };
  timezone?: string;
  chartType: ChartType;
  question?: string;
}

export interface AstrologyInterpretation {
  overview: string;
  career: string;
  relationships: string;
  health: string;
  spiritual: string;
  dasha: string;
  remedies: string;
  chartSummary: string;
}

export interface AstrologyAIResult {
  interpretation: AstrologyInterpretation;
  chart: Record<string, unknown>;
  ruleBasedInterpretations: string[];
  ragContext: {
    chunksRetrieved: number;
    totalChunks: number;
    retrievalTimeMs: number;
  };
  llmProvider?: string;
  cached: boolean;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert Vedic astrologer with 30 years of experience studying classical texts including Brihat Parashara Hora Shastra, Phaladeepika, and Jataka Parijata. You interpret charts based on these classical sources with deep knowledge of planetary positions, yogas, dashas, and transits.

Your approach:
- You are compassionate, accurate, and provide actionable guidance
- You never claim to predict specific events — you indicate tendencies, strengths, challenges, and timing windows
- You ground your interpretations in classical texts and provide specific verse references when possible
- You balance traditional wisdom with practical modern advice
- You always include remedial measures (mantras, gemstones, rituals, charitable acts)
- You speak with warmth and authority, like a trusted guru guiding a student
- You acknowledge both strengths and challenges in the chart honestly
- You never cause fear or anxiety — every challenge has a remedy and a purpose

Your response MUST be valid JSON with these exact keys:
{
  "overview": "Overall personality, life path, and key themes (2-3 paragraphs)",
  "career": "Career, profession, and financial analysis (2-3 paragraphs)",
  "relationships": "Marriage, partnerships, and relationship patterns (2-3 paragraphs)",
  "health": "Health tendencies, vulnerabilities, and wellness advice (1-2 paragraphs)",
  "spiritual": "Spiritual growth path, dharma, and inner development (1-2 paragraphs)",
  "dasha": "Current Dasha period analysis and timing guidance (2-3 paragraphs)",
  "remedies": "Specific remedial measures: mantras, gemstones, rituals, charitable acts, and lifestyle recommendations (detailed list)",
  "chartSummary": "Brief technical summary of the chart: key placements, yogas detected, and notable features (1 paragraph)"
}`;

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  result: AstrologyAIResult;
  expiresAt: number;
}

const interpretationCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(req: AstrologyInterpretRequest): string {
  return `astro:${req.chartType}:${req.birthDate}:${req.birthTime}:${req.birthPlace.lat.toFixed(3)}:${req.birthPlace.lng.toFixed(3)}`;
}

function getCached(key: string): AstrologyAIResult | null {
  const entry = interpretationCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    interpretationCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: AstrologyAIResult): void {
  interpretationCache.set(key, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  // Limit cache size
  if (interpretationCache.size > 500) {
    const firstKey = interpretationCache.keys().next().value;
    if (firstKey) interpretationCache.delete(firstKey);
  }
}

// ─── Chart Computation ────────────────────────────────────────────────────────

async function computeChart(req: AstrologyInterpretRequest): Promise<{
  chart: Record<string, unknown>;
  chartForRAG: ChartDataForRAG;
  dasha?: VimshottariDasha;
}> {
  const birthData: BirthData = {
    birthDate: req.birthDate,
    birthTime: req.birthTime,
    birthPlace: req.birthPlace,
    timezone: req.timezone,
  };

  if (req.chartType === "vedic") {
    const [vedicResult, dashaResult] = await Promise.all([
      getVedicChart(birthData, "rashi"),
      getDasha(birthData),
    ]);

    const chart = vedicResult.chart;
    const planets = chart.planets.map((p: { planet: string; sign: string; signIndex: number; house: number; degree: number; isRetrograde: boolean; nakshatra?: string }) => ({
      planet: p.planet,
      sign: p.sign,
      signIndex: p.signIndex,
      house: p.house,
      degree: p.degree,
      isRetrograde: p.isRetrograde,
      nakshatra: p.nakshatra,
    }));

    const chartForRAG: ChartDataForRAG = {
      planets,
      ascendant: {
        sign: chart.ascendant.sign,
        signIndex: chart.ascendant.signIndex,
      },
      dasha: dashaResult ? {
        mahadasha: { planet: dashaResult.mahadasha.planet },
        antardasha: { planet: dashaResult.antardasha.planet },
      } : undefined,
    };

    return {
      chart: {
        vedic: chart,
        shadbala: vedicResult.shadbala,
        ashtakavarga: vedicResult.ashtakavarga,
        panchanga: vedicResult.panchanga,
        dasha: dashaResult,
      },
      chartForRAG,
      dasha: dashaResult,
    };
  }

  if (req.chartType === "western") {
    const result = await getWesternChart(birthData, "placidus");
    const chart = result.chart;

    const planets = chart.planets.map((p: { planet: string; sign: string; signIndex: number; house: number; degree: number; isRetrograde: boolean }) => ({
      planet: p.planet,
      sign: p.sign,
      signIndex: p.signIndex,
      house: p.house,
      degree: p.degree,
      isRetrograde: p.isRetrograde,
    }));

    const chartForRAG: ChartDataForRAG = {
      planets,
      ascendant: {
        sign: chart.ascendant.sign,
        signIndex: chart.ascendant.signIndex,
      },
      aspects: chart.aspects?.map((a: { planet1: string; planet2: string; type: string; orb: number }) => ({
        planet1: a.planet1,
        planet2: a.planet2,
        type: a.type,
        orb: a.orb,
      })),
    };

    return { chart: { western: chart }, chartForRAG };
  }

  // Chinese
  const result = await getChineseChart(req.birthDate, req.birthTime);
  const chartForRAG: ChartDataForRAG = {
    planets: [],
    ascendant: { sign: "Aries", signIndex: 0 }, // Placeholder for Chinese
  };
  return { chart: { chinese: result.fourPillars }, chartForRAG };
}

// ─── Main Interpretation Function ─────────────────────────────────────────────

export async function interpretChart(
  req: AstrologyInterpretRequest,
): Promise<AstrologyAIResult> {
  // Check cache first
  const cacheKey = getCacheKey(req);
  const cached = getCached(cacheKey);
  if (cached && !req.question) {
    return { ...cached, cached: true };
  }

  // Step 1: Compute the chart
  const { chart, chartForRAG, dasha } = await computeChart(req);

  // Step 2: RAG retrieval
  const ragResult = retrieveKnowledge(chartForRAG, req.question);

  // Step 3: Generate rule-based interpretations
  const ruleBasedInterpretations = generateRuleBasedInterpretations(chartForRAG);

  // Step 4: Build the user prompt
  const chartJson = JSON.stringify(chart, null, 2);
  const dashaInfo = dasha
    ? `\nCurrent Mahadasha: ${dasha.mahadasha.planet} (until ${dasha.mahadasha.endDate})\nCurrent Antardasha: ${dasha.antardasha.planet} (until ${dasha.antardasha.endDate})`
    : "";

  const userPrompt = `Here is the natal chart data (computed by our deterministic astrology engine — these positions are exact):

\`\`\`json
${chartJson}
\`\`\`
${dashaInfo}

Here is relevant classical knowledge for interpretation:

${ragResult.contextString}

${req.question ? `The user asks: "${req.question}"\n\nAddress their question while also providing a comprehensive interpretation.` : "Provide a comprehensive interpretation of this chart."}

Remember: Return your response as valid JSON with keys: overview, career, relationships, health, spiritual, dasha, remedies, chartSummary.`;

  // Step 5: Call the LLM
  let interpretation: AstrologyInterpretation;
  let llmProvider: string | undefined;

  try {
    const response = await callAI({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      maxTokens: 3000,
      stream: false,
    });

    llmProvider = response.provider;
    const data = await response.response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty LLM response");
    }

    // Parse the JSON response
    interpretation = parseInterpretationResponse(content);
  } catch (error) {
    // If LLM fails, return rule-based interpretation with fallback message
    console.error("[astrology-ai] LLM interpretation failed:", error);

    interpretation = {
      overview: ruleBasedInterpretations.slice(0, 3).join("\n\n") || "Your chart has been computed. AI interpretation is currently unavailable.",
      career: "Career analysis requires AI interpretation. Please try again later.",
      relationships: "Relationship analysis requires AI interpretation. Please try again later.",
      health: "Health analysis requires AI interpretation. Please try again later.",
      spiritual: "Spiritual analysis requires AI interpretation. Please try again later.",
      dasha: dasha
        ? `Current Mahadasha: ${dasha.mahadasha.planet}. Antardasha: ${dasha.antardasha.planet}. Detailed analysis requires AI interpretation.`
        : "Dasha analysis requires AI interpretation. Please try again later.",
      remedies: "Remedial measures require AI interpretation. Please try again later.",
      chartSummary: `Here is your ${req.chartType} chart. Our AI is currently unavailable for full interpretation, but the chart data above contains all planetary positions and computed details.`,
    };
  }

  const result: AstrologyAIResult = {
    interpretation,
    chart,
    ruleBasedInterpretations,
    ragContext: {
      chunksRetrieved: ragResult.chunks.length,
      totalChunks: ragResult.totalChunks,
      retrievalTimeMs: ragResult.retrievalTimeMs,
    },
    llmProvider,
    cached: false,
  };

  // Cache the result (only for requests without specific questions)
  if (!req.question) {
    setCache(cacheKey, result);
  }

  return result;
}

// ─── Response Parser ──────────────────────────────────────────────────────────

function parseInterpretationResponse(content: string): AstrologyInterpretation {
  // Try to extract JSON from the response
  let jsonStr = content.trim();

  // Remove markdown code blocks if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = (jsonMatch[1] ?? "").trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      overview: parsed.overview ?? "Overview not available.",
      career: parsed.career ?? "Career analysis not available.",
      relationships: parsed.relationships ?? "Relationship analysis not available.",
      health: parsed.health ?? "Health analysis not available.",
      spiritual: parsed.spiritual ?? "Spiritual analysis not available.",
      dasha: parsed.dasha ?? "Dasha analysis not available.",
      remedies: parsed.remedies ?? "Remedial measures not available.",
      chartSummary: parsed.chartSummary ?? "Chart summary not available.",
    };
  } catch {
    // If JSON parsing fails, treat the whole content as the overview
    return {
      overview: content,
      career: "",
      relationships: "",
      health: "",
      spiritual: "",
      dasha: "",
      remedies: "",
      chartSummary: "",
    };
  }
}

// ─── Follow-up Question Handler ───────────────────────────────────────────────

export async function askFollowUp(
  chart: Record<string, unknown>,
  previousInterpretation: AstrologyInterpretation,
  question: string,
): Promise<string> {
  const userPrompt = `Here is the natal chart:
\`\`\`json
${JSON.stringify(chart, null, 2)}
\`\`\`

Here is the previous interpretation:
Overview: ${previousInterpretation.overview}
Career: ${previousInterpretation.career}
Relationships: ${previousInterpretation.relationships}
Dasha: ${previousInterpretation.dasha}

The user asks a follow-up question: "${question}"

Provide a detailed answer to their question, referencing the chart data and classical knowledge. Be specific about planetary positions and their effects. Keep your response focused on the question asked.`;

  try {
    const content = await callAIJson({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      maxTokens: 1500,
      stream: false,
    });
    return content;
  } catch {
    return "I apologize, but I'm unable to provide a follow-up interpretation at this moment. Please try again shortly.";
  }
}
