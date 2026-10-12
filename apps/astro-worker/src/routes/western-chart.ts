// ============================================================================
// Western Chart Route
// ============================================================================

import {
  computeWesternNatalChart,
} from "@zeal/astrology";
import type { BirthData, HouseSystem } from "@zeal/astrology";

interface WesternChartInput {
  birthDate: string;
  birthTime: string;
  birthPlace: { lat: number; lng: number };
  houseSystem: string;
}

export function handleWesternChart(input: WesternChartInput): Response {
  const birthData: BirthData = {
    birthDate: input.birthDate,
    birthTime: input.birthTime,
    birthPlace: input.birthPlace,
  };

  const validSystems: HouseSystem[] = ["placidus", "whole-sign", "koch", "equal"];
  const houseSystem: HouseSystem = validSystems.includes(input.houseSystem as HouseSystem)
    ? (input.houseSystem as HouseSystem)
    : "placidus";

  const chart = computeWesternNatalChart(birthData, houseSystem);

  const response = {
    success: true,
    data: {
      chart,
    },
  };

  return new Response(JSON.stringify(response), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
