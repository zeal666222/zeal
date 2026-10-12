// ═══════════════════════════════════════════════════════════════════════════════
// Scenario: Mixed — realistic mixed workload
// ═══════════════════════════════════════════════════════════════════════════════
// Simulates a realistic distribution of user activity:
//   40% browsing (homepage, explore)
//   25% searching
//   20% viewing profiles
//   10% AI chat
//    5% astrology
//
// Target: 100 VUs for 15 minutes
// ═══════════════════════════════════════════════════════════════════════════════

import http from "k6/http";
import { check, sleep, group } from "k6";
import { baseUrl, publicHeaders, authHeaders, randomId, randomPick } from "../k6.config.js";

export const options = {
  stages: [
    { duration: "2m", target: 50 },   // ramp up
    { duration: "10m", target: 100 }, // sustain peak
    { duration: "3m", target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<3000", "p(99)<8000"],
    http_req_failed: ["rate<0.03"],
    http_reqs: ["rate>200"], // expect at least 200 req/s
  },
};

const CATEGORIES = ["ASTROLOGER", "TAROT_READER", "NUMEROLOGIST", "VASTU_EXPERT"];
const SEARCH_TERMS = ["love", "career", "health", "money", "vedic", "tarot"];
const MESSAGES = [
  "Hi, I need guidance.",
  "What does my chart say?",
  "Tell me about my future.",
  "I need advice on relationships.",
];

export default function () {
  const roll = Math.random();

  if (roll < 0.15) {
    // ─── Homepage (15%) ──────────────────────────────────────────────────
    group("homepage", () => {
      const res = http.get(`${baseUrl()}/`, {
        headers: publicHeaders(),
        tags: { name: "GET / (mixed)" },
      });
      check(res, { "homepage 200": (r) => r.status === 200 });
    });
  } else if (roll < 0.40) {
    // ─── Explore / Browse (25%) ──────────────────────────────────────────
    group("explore", () => {
      const res = http.get(`${baseUrl()}/explore`, {
        headers: publicHeaders(),
        tags: { name: "GET /explore (mixed)" },
      });
      check(res, { "explore 200": (r) => r.status === 200 });

      sleep(Math.random() * 2 + 0.5);

      // Maybe search
      if (Math.random() < 0.5) {
        const category = randomPick(CATEGORIES);
        const searchRes = http.get(
          `${baseUrl()}/api/consultants/search?category=${category}&page=1`,
          {
            headers: publicHeaders(),
            tags: { name: "GET /api/consultants/search (mixed)" },
          },
        );
        check(searchRes, { "search 200": (r) => r.status === 200 });
      }
    });
  } else if (roll < 0.60) {
    // ─── Profile view (20%) ──────────────────────────────────────────────
    group("profile", () => {
      const res = http.get(`${baseUrl()}/api/consultants/featured`, {
        headers: publicHeaders(),
        tags: { name: "GET /api/consultants/featured (mixed)" },
      });
      check(res, { "featured 200": (r) => r.status === 200 });
    });
  } else if (roll < 0.80) {
    // ─── AI Chat (20%) ───────────────────────────────────────────────────
    group("chat", () => {
      const conversationId = randomId();
      const consultantId = "test-ai-consultant-id";
      const message = randomPick(MESSAGES);

      const res = http.post(
        `${baseUrl()}/api/chat/ai/${consultantId}`,
        JSON.stringify({ conversationId, content: message }),
        {
          headers: authHeaders(),
          tags: { name: "POST /api/chat/ai (mixed)" },
          timeout: "15s",
        },
      );
      check(res, {
        "chat received": (r) => r.status === 200 || r.status === 429,
      });
    });
  } else if (roll < 0.90) {
    // ─── Astrology (10%) ─────────────────────────────────────────────────
    group("astrology", () => {
      const res = http.post(
        `${baseUrl()}/api/astrology/compute`,
        JSON.stringify({
          birthDate: "1990-05-15",
          birthTime: "06:30",
          birthPlace: "Mumbai, India",
          latitude: 19.076,
          longitude: 72.8777,
          chartType: "vedic",
        }),
        {
          headers: authHeaders(),
          tags: { name: "POST /api/astrology/compute (mixed)" },
          timeout: "10s",
        },
      );
      check(res, { "astrology 200": (r) => r.status === 200 });
    });
  } else {
    // ─── Search (10%) ────────────────────────────────────────────────────
    group("search", () => {
      const term = randomPick(SEARCH_TERMS);
      const res = http.get(
        `${baseUrl()}/api/consultants/search?q=${term}&page=1&limit=20`,
        {
          headers: publicHeaders(),
          tags: { name: "GET /api/consultants/search?q (mixed)" },
        },
      );
      check(res, { "search 200": (r) => r.status === 200 });
    });
  }

  // Think time between actions
  sleep(Math.random() * 4 + 1);
}
