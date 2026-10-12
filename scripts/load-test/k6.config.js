// ═══════════════════════════════════════════════════════════════════════════════
// k6 configuration — shared options for all load test scenarios
// ═══════════════════════════════════════════════════════════════════════════════
// Run individual scenarios:
//   k6 run scripts/load-test/scenarios/homepage.js
//   k6 run scripts/load-test/scenarios/explore.js
//   k6 run scripts/load-test/scenarios/chat.js
//   k6 run scripts/load-test/scenarios/astrology.js
//   k6 run scripts/load-test/scenarios/mixed.js
//
// Run all with output to cloud:
//   k6 run --out cloud scripts/load-test/scenarios/mixed.js
//
// Environment variables:
//   BASE_URL      — target URL (default: http://localhost:3000)
//   AUTH_TOKEN    — JWT for authenticated endpoints
// ═══════════════════════════════════════════════════════════════════════════════

export const options = {
  // Default thresholds — overridden per scenario
  thresholds: {
    http_req_duration: ["p(95)<2000", "p(99)<5000"],
    http_req_failed: ["rate<0.05"],
    http_req_connecting: ["p(95)<500"],
  },

  // Scenarios are defined in individual files
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";

/**
 * Build an authenticated request.
 */
export function authHeaders() {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
  }
  return headers;
}

/**
 * Build a public (unauthenticated) request.
 */
export function publicHeaders() {
  return {
    Accept: "text/html,application/json",
    "User-Agent": "ZealLoadTest/1.0",
  };
}

/**
 * Get the base URL.
 */
export function baseUrl() {
  return BASE_URL;
}

/**
 * Generate a random UUID-like string for test data.
 */
export function randomId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Pick a random element from an array.
 */
export function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Sleep with jitter (±25%).
 */
export function jitterSleep(baseSeconds) {
  const jitter = baseSeconds * 0.25 * (Math.random() * 2 - 1);
  return baseSeconds + jitter;
}
