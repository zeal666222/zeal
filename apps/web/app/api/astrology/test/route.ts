// ============================================================================
// Astrology Test Route
// ============================================================================
// Accepts birth data, calls the astro-worker, and returns the result.
// Usage: POST /api/astrology/test
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getVedicChart, getWesternChart, getChineseChart } from "@/lib/astrology/client";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { birthDate, birthTime, birthPlace, system } = body as {
      birthDate?: string;
      birthTime?: string;
      birthPlace?: { lat: number; lng: number };
      system?: "vedic" | "western" | "chinese";
    };

    if (!birthDate || !birthTime) {
      return NextResponse.json(
        { error: "birthDate and birthTime are required" },
        { status: 400 }
      );
    }

    const birthData = {
      birthDate,
      birthTime,
      birthPlace: birthPlace ?? { lat: 21.6417, lng: 69.6033 },
    };

    let result: unknown;

    switch (system) {
      case "western":
        result = await getWesternChart(birthData);
        break;
      case "chinese":
        result = await getChineseChart(birthDate, birthTime);
        break;
      case "vedic":
      default:
        result = await getVedicChart(birthData);
        break;
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (/fetch failed|failed to fetch|econnrefused|enotfound|networkerror/i.test(message)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Astro worker engine is offline (ASTRO_WORKER_URL unreachable). Use /api/kundali, which computes charts with the built-in local engine.",
          code: "UPSTREAM_UNAVAILABLE",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
