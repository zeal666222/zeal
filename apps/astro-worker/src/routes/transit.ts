// ============================================================================
// Transit Route
// ============================================================================

import { computeTransit, computeWesternTransit } from "@zeal/astrology";
import type { BirthData } from "@zeal/astrology";

interface TransitInput {
  birthDate: string;
  birthTime: string;
  birthPlace: { lat: number; lng: number };
  transitDate: string;
}

export function handleTransit(input: TransitInput): Response {
  const birthData: BirthData = {
    birthDate: input.birthDate,
    birthTime: input.birthTime,
    birthPlace: input.birthPlace,
  };

  // Compute both Vedic and Western transits
  const vedicTransit = computeTransit(birthData, input.transitDate);
  const westernTransit = computeWesternTransit(birthData, input.transitDate);

  const response = {
    success: true,
    data: {
      vedic: vedicTransit,
      western: westernTransit,
    },
  };

  return new Response(JSON.stringify(response), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
