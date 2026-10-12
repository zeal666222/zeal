// ============================================================================
// Health Check Route
// ============================================================================

export function handleHealth(): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        status: "healthy",
        service: "zeal-astro",
        version: "0.1.0",
        timestamp: new Date().toISOString(),
        capabilities: [
          "vedic-rashi",
          "vedic-navamsa",
          "vedic-divisional",
          "vedic-dasha",
          "vedic-panchanga",
          "vedic-shadbala",
          "vedic-ashtakavarga",
          "vedic-transit",
          "western-natal",
          "western-transit",
          "western-progression",
          "western-synastry",
          "chinese-bazi",
        ],
      },
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
