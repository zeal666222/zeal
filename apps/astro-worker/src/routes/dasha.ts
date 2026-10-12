// ============================================================================
// Dasha Route (Vimshottari Dasha)
// ============================================================================

import { computeVimshottariDasha } from "@zeal/astrology";
import type { BirthData } from "@zeal/astrology";

interface DashaInput {
  birthDate: string;
  birthTime: string;
  birthPlace: { lat: number; lng: number };
}

export function handleDasha(input: DashaInput): Response {
  const birthData: BirthData = {
    birthDate: input.birthDate,
    birthTime: input.birthTime,
    birthPlace: input.birthPlace,
  };

  const dasha = computeVimshottariDasha(birthData);

  const response = {
    success: true,
    data: dasha,
  };

  return new Response(JSON.stringify(response), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
