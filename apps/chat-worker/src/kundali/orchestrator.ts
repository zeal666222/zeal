// ============================================================================
// Kundali Orchestrator — unified birth-data → chart → SSE → prompt flow
// ============================================================================
// Industry-grade state machine for the mid-chat birth data disclosure flow.
//
// Responsibilities (single entry point, clear outputs):
//   1. Detect birth data in user message (delegated to caller)
//   2. Persist birth data to seeker_profile
//   3. Compute kundali chart (server-side, authoritative)
//   4. Produce SSE event payload for client SVG rendering
//   5. Signal that AI prompt must be rebuilt with denial instruction
//
// This module owns the ENTIRE flow so ai-chat-handler.ts stays thin.
// ============================================================================

import type { Env } from "../env";
import { detectBirthData, type DetectedBirthData } from "../support/birth-data-detector";
import {
  describeProfile,
  readSeekerProfile,
  saveSeekerProfile,
  type SeekerProfileRow,
} from "../seeker-profile";
import { ensureChart } from "./service";
import { PersonaEngine } from "../persona-engine";
import type { PersonaContext } from "../persona-loader";
import {
  computeRashiChart,
  computeDivisionalChart,
  computeVimshottariDasha,
  computeNavamsaChart,
  parseBirthDateTime,
  getAstroTime,
  getAyanamsa,
  getVedicPlanetPositions,
  degreesToSignDeg,
  getNakshatra,
} from "@zeal/astrology";
import type { BirthData, PlanetPosition, DivisionalChart } from "@zeal/astrology";

/** SSE event payload sent to client for SVG chart rendering */
export interface KundaliChartEvent {
  type: "kundali_chart";
  birth: {
    name?: string | null;
    dob: string;
    tob: string;
    pob: string;
    latitude: number | null;
    longitude: number | null;
    timezone?: string | null;
  };
  // Extended data for industry-grade rendering
  chart?: {
    ascendantSign: string;
    houses: Array<{ house: number; sign: string }>;
    planets: Array<{
      planet: string;
      sign: string;
      signIndex: number;
      house: number;
      degree: number;
      isRetrograde: boolean;
    }>;
    nakshatra: string;
    dasha: {
      mahadasha: string;
      antardasha: string;
      remaining: number;
    };
  };
  divisionalCharts?: Array<{
    division: number;
    chartName: string;
    ascendantSign: string;
    houses: Array<{ house: number; sign: string }>;
    planets: Array<{
      planet: string;
      sign: string;
      signIndex: number;
      house: number;
      degree: number;
      isRetrograde: boolean;
    }>;
  }>;
  dashaTimeline?: {
    mahadashas: Array<{
      planet: string;
      startDate: string;
      endDate: string;
      years: number;
      antardashas?: Array<{
        planet: string;
        startDate: string;
        endDate: string;
        years: number;
      }>;
    }>;
    currentMahadasha: string;
    currentAntardasha: string;
    yearsRemaining: number;
  };
  planetaryPositions?: {
    planets: Array<{
      planet: string;
      sign: string;
      signIndex: number;
      house: number;
      degree: number;
      minute: number;
      second: number;
      absoluteDegree: number;
      nakshatra: string;
      nakshatraPada: number;
      nakshatraLord: string;
      isRetrograde: boolean;
      isCombust?: boolean;
      isExalted?: boolean;
      isDebilitated?: boolean;
      isOwnSign?: boolean;
    }>;
    ascendant: {
      sign: string;
      signIndex: number;
      degree: number;
      nakshatra: string;
      nakshatraPada: number;
    };
    ayanamsa: number;
  };
}

/** Profile update event for client-side state sync */
export interface ProfileUpdateEvent {
  profileUpdated: {
    chartStale: boolean;
    hasBirthData: boolean;
    missing: string[];
    name?: string | null;
    dob?: string | null;
    tob?: string | null;
    pob?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    timezone?: string | null;
  };
}

/** Result of orchestrating birth data disclosure */
export interface OrchestratedBirthResult {
  /** SSE events to emit BEFORE AI text streaming */
  events: Array<KundaliChartEvent | ProfileUpdateEvent>;
  /** Rebuilt system prompt with chartBlock instructing denial (not interpretation) */
  rebuiltSystemPrompt: string;
  /** Whether birth data was actually detected and processed */
  processed: boolean;
}

/**
 * Orchestrate the full birth-data disclosure flow.
 *
 * Call this when detectBirthData() returns a confident match. It handles:
 * - Persisting birth data to seeker_profile
 * - Computing the kundali chart
 * - Building SSE events for client rendering
 * - Rebuilding the AI system prompt with denial instruction
 *
 * Returns events to emit and the rebuilt system prompt.
 */
export async function orchestrateBirthDisclosure(
  env: Env,
  userId: string,
  detected: DetectedBirthData,
  persona: PersonaContext,
): Promise<OrchestratedBirthResult> {
  // Step 1: Persist birth data to seeker profile
  const stored = await saveSeekerProfile(env, userId, {
    dob: detected.birthDate,
    tob: detected.birthTime,
    pob: detected.placeName,
    latitude: detected.birthPlace.lat,
    longitude: detected.birthPlace.lng,
    timezone: detected.timezone,
  });

  if (!stored) {
    // Profile save failed — return empty result, AI continues normally
    return { events: [], rebuiltSystemPrompt: persona.systemPrompt, processed: false };
  }

  // Step 2: Compute the chart (server-side, authoritative)
  await ensureChart(env, userId, stored);

  // Step 3: Read fresh profile for event payloads
  const refreshed = await readSeekerProfile(env, userId);
  if (!refreshed?.dob || !refreshed?.tob || !refreshed?.pob) {
    // Chart computation requires all three — abort gracefully
    return { events: [], rebuiltSystemPrompt: persona.systemPrompt, processed: false };
  }

  // Step 4: Build SSE events
  const events: Array<KundaliChartEvent | ProfileUpdateEvent> = [];

  // Profile update event (client state sync)
  events.push({
    profileUpdated: {
      chartStale: describeProfile(refreshed).chartStale,
      hasBirthData: describeProfile(refreshed).hasBirthData,
      missing: describeProfile(refreshed).missing,
      name: refreshed.name,
      dob: refreshed.dob,
      tob: refreshed.tob,
      pob: refreshed.pob,
      latitude: refreshed.latitude,
      longitude: refreshed.longitude,
      timezone: refreshed.timezone,
    },
  });

  // Compute extended chart data
  const extendedData = await computeExtendedChartData(refreshed);

  // Kundali chart event (triggers SVG rendering)
  events.push({
    type: "kundali_chart",
    birth: {
      name: refreshed.name,
      dob: refreshed.dob,
      tob: refreshed.tob,
      pob: refreshed.pob,
      latitude: refreshed.latitude,
      longitude: refreshed.longitude,
      timezone: refreshed.timezone,
    },
    ...extendedData,
  });

  // Step 5: Rebuild system prompt with birthDataJustDetected=true
  // This makes the chartBlock instruct DENIAL instead of interpretation
  const seekerCtx = {
    name: refreshed.name ?? undefined,
    dob: refreshed.dob ?? undefined,
    tob: refreshed.tob ?? undefined,
    pob: refreshed.pob ?? undefined,
    concern: refreshed.concern ?? undefined,
    chartSummary: refreshed.chart_summary ?? undefined,
  };

  const rebuilt = PersonaEngine.build({
    id: persona.id,
    name: persona.name,
    category: persona.category,
    bio: persona.bio,
    specialties: persona.specialties,
    languages: persona.languages,
    persona: persona.persona,
    systemPrompt: persona.systemPrompt,
    location: persona.location,
    country: persona.country,
    religion: persona.religion,
    lineage: persona.lineage,
    nativeLanguage: persona.nativeLanguage,
    gender: persona.gender,
    safetyLevel: persona.safetyLevel,
    bannedPatterns: persona.bannedPatterns,
    seekerContext: seekerCtx,
    birthDataJustDetected: true,
  });

  return {
    events,
    rebuiltSystemPrompt: rebuilt.systemPrompt,
    processed: true,
  };
}

/**
 * Build the opener kundali chart event (first message after intake form).
 * Simpler than mid-chat flow — no detection needed, just emit if birth data exists.
 */
export async function buildOpenerChartEvent(
  env: Env,
  userId: string,
): Promise<KundaliChartEvent | null> {
  const seekerRow = await readSeekerProfile(env, userId);
  if (!seekerRow?.dob || !seekerRow?.tob || !seekerRow?.pob) {
    return null;
  }

  const birth = {
    name: seekerRow.name,
    dob: seekerRow.dob,
    tob: seekerRow.tob,
    pob: seekerRow.pob,
    latitude: seekerRow.latitude,
    longitude: seekerRow.longitude,
    timezone: seekerRow.timezone,
  };

  // Compute extended chart data
  const extendedData = await computeExtendedChartData(seekerRow);

  return {
    type: "kundali_chart",
    birth,
    ...extendedData,
  };
}

/**
 * Compute all extended chart data (divisional charts, dashas, planetary positions)
 */
async function computeExtendedChartData(seekerRow: SeekerProfileRow): Promise<Partial<KundaliChartEvent>> {
  if (!seekerRow.dob || !seekerRow.tob || !seekerRow.pob) {
    return {};
  }

  try {
    const birthData: BirthData = {
      birthDate: seekerRow.dob,
      birthTime: seekerRow.tob,
      birthPlace: {
        lat: seekerRow.latitude ?? 28.6139,
        lng: seekerRow.longitude ?? 77.2090,
      },
      timezone: seekerRow.timezone ?? "Asia/Kolkata",
    };

    // Compute D1 (Rashi) chart
    const rashiChart = computeRashiChart(birthData);
    
    // Build basic chart data
    const chart = {
      ascendantSign: rashiChart.ascendant.sign,
      houses: rashiChart.houses.map((h) => ({ house: h.house, sign: h.sign })),
      planets: rashiChart.planets.map((p) => ({
        planet: p.planet,
        sign: p.sign,
        signIndex: p.signIndex,
        house: p.house,
        degree: p.degree,
        isRetrograde: p.isRetrograde,
      })),
      nakshatra: rashiChart.planets.find((p) => p.planet === "Moon")?.nakshatra ?? "Unknown",
      dasha: {
        mahadasha: "Sun", // Placeholder - will compute below
        antardasha: "Sun",
        remaining: 0,
      },
    };

    // Compute Vimshottari Dasha
    const dashaResult = computeVimshottariDasha(birthData);
    const dasha = dashaResult.allMahardashas;
    const currentDasha = dashaResult.currentDasha;
    
    // Find current mahadasha and antardasha
    const now = new Date();
    let currentMD = dasha[0];
    let currentAD = currentMD?.subPeriods?.[0];
    
    for (const md of dasha) {
      if (new Date(md.startDate) <= now && new Date(md.endDate) > now) {
        currentMD = md;
        for (const ad of md.subPeriods ?? []) {
          if (new Date(ad.startDate) <= now && new Date(ad.endDate) > now) {
            currentAD = ad;
            break;
          }
        }
        break;
      }
    }

    chart.dasha = {
      mahadasha: currentMD?.planet ?? "Sun",
      antardasha: currentAD?.planet ?? "Sun",
      remaining: currentMD ? (new Date(currentMD.endDate).getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000) : 0,
    };

    // Compute divisional charts (D1-D12)
    const divisionalCharts = [];
    for (let div = 1; div <= 12; div++) {
      try {
        const divChart = div === 9 
          ? computeNavamsaChart(birthData)
          : computeDivisionalChart(birthData, div);
        
        divisionalCharts.push({
          division: div,
          chartName: divChart.chartName,
          ascendantSign: divChart.ascendant.sign,
          houses: divChart.houses.map((h) => ({ house: h.house, sign: h.sign })),
          planets: divChart.planets.map((p) => ({
            planet: p.planet,
            sign: p.sign,
            signIndex: p.signIndex,
            house: p.house,
            degree: p.degree,
            isRetrograde: p.isRetrograde,
          })),
        });
      } catch (err) {
        console.warn(`[orchestrator] Failed to compute D${div}:`, err instanceof Error ? err.message : err);
      }
    }

    // Compute dasha timeline
    const dashaTimeline = {
      mahadashas: dasha.map((md: any) => ({
        planet: md.planet,
        startDate: md.startDate,
        endDate: md.endDate,
        years: md.durationYears ?? md.years,
        antardashas: (md.subPeriods ?? []).map((ad: any) => ({
          planet: ad.planet,
          startDate: ad.startDate,
          endDate: ad.endDate,
          years: ad.durationYears ?? ad.years,
        })),
      })),
      currentMahadasha: chart.dasha.mahadasha,
      currentAntardasha: chart.dasha.antardasha,
      yearsRemaining: chart.dasha.remaining,
    };

    // Compute detailed planetary positions
    const planetaryPositions = {
      planets: rashiChart.planets.map((p) => ({
        planet: p.planet,
        sign: p.sign,
        signIndex: p.signIndex,
        house: p.house,
        degree: p.degree,
        minute: p.minute,
        second: p.second,
        absoluteDegree: p.absoluteDegree,
        nakshatra: p.nakshatra ?? "Unknown",
        nakshatraPada: p.nakshatraPada ?? 1,
        nakshatraLord: p.nakshatraLord ?? "Unknown",
        isRetrograde: p.isRetrograde,
        isCombust: false, // TODO: Compute combustion
        isExalted: false, // TODO: Compute exaltation
        isDebilitated: false, // TODO: Compute debilitation
        isOwnSign: false, // TODO: Compute own sign
      })),
      ascendant: {
        sign: rashiChart.ascendant.sign,
        signIndex: rashiChart.ascendant.signIndex,
        degree: rashiChart.ascendant.degree,
        nakshatra: getNakshatra(rashiChart.ascendant.degree).name,
        nakshatraPada: getNakshatra(rashiChart.ascendant.degree).pada,
      },
      ayanamsa: rashiChart.ayanamsa ?? 0,
    };

    return {
      chart,
      divisionalCharts,
      dashaTimeline,
      planetaryPositions,
    };
  } catch (err) {
    console.warn("[orchestrator] Failed to compute extended chart data:", err instanceof Error ? err.message : err);
    return {};
  }
}
