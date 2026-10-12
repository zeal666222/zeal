// ============================================================================
// Chinese Chart Route (BaZi / Four Pillars)
// ============================================================================

import { computeFourPillars } from "@zeal/astrology";
import type { BirthData } from "@zeal/astrology";

interface ChineseChartInput {
  birthDate: string;
  birthTime: string;
}

export function handleChineseChart(input: ChineseChartInput): Response {
  // Chinese BaZi doesn't require birth place, but we use a default location
  const birthData: BirthData = {
    birthDate: input.birthDate,
    birthTime: input.birthTime,
    birthPlace: { lat: 35.0, lng: 105.0 }, // Default: center of China
  };

  const fourPillars = computeFourPillars(birthData);

  const response = {
    success: true,
    data: {
      fourPillars,
    },
  };

  return new Response(JSON.stringify(response), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
