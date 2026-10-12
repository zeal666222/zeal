// ============================================================================
// Vedic Chart Route
// ============================================================================

import {
  computeRashiChart,
  computeNavamsaChart,
  computeDivisionalChart,
  computeShadbala,
  computeAshtakavarga,
  computePanchanga,
} from "@zeal/astrology";
import type { BirthData, ApiResponse, NatalChart, DivisionalChart } from "@zeal/astrology";

interface VedicChartInput {
  birthDate: string;
  birthTime: string;
  birthPlace: { lat: number; lng: number };
  chartType: string;
  divisionalNumber?: number;
}

export function handleVedicChart(input: VedicChartInput): Response {
  const birthData: BirthData = {
    birthDate: input.birthDate,
    birthTime: input.birthTime,
    birthPlace: input.birthPlace,
  };

  let chart: NatalChart | DivisionalChart;

  switch (input.chartType) {
    case "rashi":
      chart = computeRashiChart(birthData);
      break;
    case "navamsa":
      chart = computeNavamsaChart(birthData);
      break;
    case "divisional": {
      const divNum = input.divisionalNumber ?? 9;
      chart = computeDivisionalChart(birthData, divNum);
      break;
    }
    default:
      return new Response(
        JSON.stringify({
          success: false,
          error: `Unknown chartType: ${input.chartType}. Use 'rashi', 'navamsa', or 'divisional'.`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
  }

  // Include additional calculations
  const shadbala = computeShadbala(birthData);
  const ashtakavarga = computeAshtakavarga(birthData);
  const panchanga = computePanchanga(birthData);

  const response = {
    success: true,
    data: {
      chart,
      shadbala,
      ashtakavarga,
      panchanga,
    },
  };

  return new Response(JSON.stringify(response), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
