// ============================================================================
// Synastry - Relationship Chart Comparison
// ============================================================================
// Compares two natal charts to assess relationship compatibility.
// Computes inter-chart aspects and optionally a composite chart.
// ============================================================================

import type { BirthData, SynastryResult, SynastryAspect, WesternNatalChart, AspectType } from "../types";
import { computeWesternNatalChart } from "./natal";
import { angularDistance } from "../utils/aspects";

/** Aspect orbs for synastry */
const SYNASTRY_ASPECTS: Array<{ type: AspectType; angle: number; orb: number }> = [
  { type: "conjunction", angle: 0, orb: 10 },
  { type: "opposition", angle: 180, orb: 8 },
  { type: "trine", angle: 120, orb: 7 },
  { type: "square", angle: 90, orb: 7 },
  { type: "sextile", angle: 60, orb: 6 },
];

/**
 * Compute synastry between two charts.
 */
export function computeSynastry(
  birthData1: BirthData,
  birthData2: BirthData
): SynastryResult {
  const chart1 = computeWesternNatalChart(birthData1);
  const chart2 = computeWesternNatalChart(birthData2);

  const aspects: SynastryAspect[] = [];

  // Compare each planet in chart1 with each planet in chart2
  for (const p1 of chart1.planets) {
    for (const p2 of chart2.planets) {
      const diff = angularDistance(p1.absoluteDegree, p2.absoluteDegree);

      for (const aspectDef of SYNASTRY_ASPECTS) {
        const orbDiff = Math.abs(diff - aspectDef.angle);
        if (orbDiff <= aspectDef.orb) {
          aspects.push({
            planet1: p1.planet,
            planet2: p2.planet,
            chart1Planet: p1.planet,
            chart2Planet: p2.planet,
            type: aspectDef.type,
            orb: Math.round(orbDiff * 100) / 100,
            exact: orbDiff < 0.5,
          });
          break;
        }
      }
    }
  }

  // Compute composite chart (midpoints)
  const compositeChart = computeCompositeChart(chart1, chart2);

  return {
    chart1,
    chart2,
    aspects,
    compositeChart,
  };
}

/**
 * Compute a composite chart from two natal charts.
 * The composite chart uses the midpoints of corresponding planets.
 */
function computeCompositeChart(
  chart1: WesternNatalChart,
  chart2: WesternNatalChart
): WesternNatalChart {
  const compositePlanets = [];

  for (const p1 of chart1.planets) {
    const p2 = chart2.planets.find(p => p.planet === p1.planet);
    if (!p2) continue;

    // Calculate midpoint
    let midpoint: number;
    const diff = Math.abs(p1.absoluteDegree - p2.absoluteDegree);
    if (diff <= 180) {
      midpoint = (p1.absoluteDegree + p2.absoluteDegree) / 2;
    } else {
      midpoint = ((p1.absoluteDegree + p2.absoluteDegree) / 2 + 180) % 360;
    }

    compositePlanets.push({
      ...p1,
      absoluteDegree: midpoint,
      sign: p1.sign, // Will be recalculated
    });
  }

  // Use chart1's house system for the composite
  return {
    ...chart1,
    chartName: "Composite Chart",
    planets: compositePlanets,
    computedAt: new Date().toISOString(),
  };
}
