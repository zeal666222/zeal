// ============================================================================
// Astro Worker - Cloudflare Worker Entry Point
// ============================================================================
// API server for astrology calculations.
// Deployable as a Cloudflare Worker with WASM support.
// ============================================================================

import { handleVedicChart } from "./routes/vedic-chart";
import { handleWesternChart } from "./routes/western-chart";
import { handleChineseChart } from "./routes/chinese-chart";
import { handleDasha } from "./routes/dasha";
import { handleTransit } from "./routes/transit";
import { handleHealth } from "./routes/health";

export interface Env {
  ENVIRONMENT: string;
}

/** CORS headers for cross-origin requests */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function errorResponse(message: string, status: number = 400): Response {
  return jsonResponse({ success: false, error: message }, status);
}

/** Validate birth data fields */
function validateBirthData(body: Record<string, unknown>): {
  valid: boolean;
  error?: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: { lat: number; lng: number };
} {
  const birthDate = body.birthDate;
  const birthTime = body.birthTime;
  const birthPlace = body.birthPlace as { lat: number; lng: number } | undefined;

  if (!birthDate || typeof birthDate !== "string") {
    return { valid: false, error: "birthDate is required (format: YYYY-MM-DD)" };
  }
  if (!birthTime || typeof birthTime !== "string") {
    return { valid: false, error: "birthTime is required (format: HH:MM)" };
  }
  if (!birthPlace || typeof birthPlace.lat !== "number" || typeof birthPlace.lng !== "number") {
    return { valid: false, error: "birthPlace with lat and lng is required" };
  }
  if (birthPlace.lat < -90 || birthPlace.lat > 90) {
    return { valid: false, error: "Latitude must be between -90 and 90" };
  }
  if (birthPlace.lng < -180 || birthPlace.lng > 180) {
    return { valid: false, error: "Longitude must be between -180 and 180" };
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return { valid: false, error: "birthDate must be in YYYY-MM-DD format" };
  }
  // Validate time format
  if (!/^\d{2}:\d{2}$/.test(birthTime)) {
    return { valid: false, error: "birthTime must be in HH:MM format" };
  }

  return {
    valid: true,
    birthDate,
    birthTime,
    birthPlace,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    try {
      // Health check
      if (path === "/api/health" && method === "GET") {
        return handleHealth();
      }

      // Vedic chart
      if (path === "/api/chart/vedic" && method === "POST") {
        const body = await request.json() as Record<string, unknown>;
        const validation = validateBirthData(body);
        if (!validation.valid) {
          return errorResponse(validation.error!, 400);
        }
        return handleVedicChart({
          birthDate: validation.birthDate!,
          birthTime: validation.birthTime!,
          birthPlace: validation.birthPlace!,
          chartType: (body.chartType as string) || "rashi",
          divisionalNumber: body.divisionalNumber as number | undefined,
        });
      }

      // Western chart
      if (path === "/api/chart/western" && method === "POST") {
        const body = await request.json() as Record<string, unknown>;
        const validation = validateBirthData(body);
        if (!validation.valid) {
          return errorResponse(validation.error!, 400);
        }
        return handleWesternChart({
          birthDate: validation.birthDate!,
          birthTime: validation.birthTime!,
          birthPlace: validation.birthPlace!,
          houseSystem: (body.houseSystem as string) || "placidus",
        });
      }

      // Chinese chart
      if (path === "/api/chart/chinese" && method === "POST") {
        const body = await request.json() as Record<string, unknown>;
        if (!body.birthDate || !body.birthTime) {
          return errorResponse("birthDate and birthTime are required", 400);
        }
        return handleChineseChart({
          birthDate: body.birthDate as string,
          birthTime: body.birthTime as string,
        });
      }

      // Dasha
      if (path === "/api/dasha" && method === "POST") {
        const body = await request.json() as Record<string, unknown>;
        const validation = validateBirthData(body);
        if (!validation.valid) {
          return errorResponse(validation.error!, 400);
        }
        return handleDasha({
          birthDate: validation.birthDate!,
          birthTime: validation.birthTime!,
          birthPlace: validation.birthPlace!,
        });
      }

      // Transit
      if (path === "/api/transit" && method === "POST") {
        const body = await request.json() as Record<string, unknown>;
        const validation = validateBirthData(body);
        if (!validation.valid) {
          return errorResponse(validation.error!, 400);
        }
        if (!body.transitDate || typeof body.transitDate !== "string") {
          return errorResponse("transitDate is required (format: YYYY-MM-DD)", 400);
        }
        return handleTransit({
          birthDate: validation.birthDate!,
          birthTime: validation.birthTime!,
          birthPlace: validation.birthPlace!,
          transitDate: body.transitDate,
        });
      }

      // 404 for unknown routes
      return errorResponse("Not found", 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      return errorResponse(message, 500);
    }
  },
};
