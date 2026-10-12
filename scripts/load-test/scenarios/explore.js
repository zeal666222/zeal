// ═══════════════════════════════════════════════════════════════════════════════
// Scenario: Explore — load test the explore/search page
// ═══════════════════════════════════════════════════════════════════════════════
// Target: 500 req/s sustained
// Simulates browsing + searching consultants
// ═══════════════════════════════════════════════════════════════════════════════

import http from "k6/http";
import { check, sleep } from "k6";
import { baseUrl, publicHeaders, randomPick } from "../k6.config.js";

export const options = {
  stages: [
    { duration: "1m", target: 50 },
    { duration: "3m", target: 50 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000", "p(99)<5000"],
    http_req_failed: ["rate<0.02"],
  },
};

const CATEGORIES = [
  "ASTROLOGER",
  "TAROT_READER",
  "NUMEROLOGIST",
  "VASTU_EXPERT",
  "PALM_READER",
];

const SEARCH_TERMS = [
  "love",
  "career",
  "health",
  "money",
  "relationship",
  "vedic",
  "numerology",
  "tarot",
];

export default function () {
  // 1. Load explore page
  const exploreRes = http.get(`${baseUrl()}/explore`, {
    headers: publicHeaders(),
    tags: { name: "GET /explore" },
  });

  check(exploreRes, {
    "explore status 200": (r) => r.status === 200,
  });

  sleep(Math.random() * 2 + 0.5);

  // 2. Search by category (70% of users)
  if (Math.random() < 0.7) {
    const category = randomPick(CATEGORIES);
    const searchRes = http.get(
      `${baseUrl()}/api/consultants/search?category=${category}&page=1&limit=20`,
      {
        headers: publicHeaders(),
        tags: { name: "GET /api/consultants/search (category)" },
      },
    );

    check(searchRes, {
      "search status 200": (r) => r.status === 200,
      "search has results": (r) => {
        try {
          const data = JSON.parse(r.body);
          return Array.isArray(data) || (data.data && data.data.length >= 0);
        } catch {
          return false;
        }
      },
    });

    sleep(Math.random() * 2 + 1);
  }

  // 3. Text search (40% of users)
  if (Math.random() < 0.4) {
    const term = randomPick(SEARCH_TERMS);
    const textRes = http.get(
      `${baseUrl()}/api/consultants/search?q=${term}&page=1&limit=20`,
      {
        headers: publicHeaders(),
        tags: { name: "GET /api/consultants/search (text)" },
      },
    );

    check(textRes, {
      "text search 200": (r) => r.status === 200,
    });

    sleep(Math.random() * 2 + 0.5);
  }

  // 4. View a consultant profile (50% of users)
  if (Math.random() < 0.5) {
    // Use a known consultant ID or a random one
    const profileRes = http.get(
      `${baseUrl()}/api/consultants/featured`,
      {
        headers: publicHeaders(),
        tags: { name: "GET /api/consultants/featured" },
      },
    );

    check(profileRes, {
      "profile list 200": (r) => r.status === 200,
    });
  }
}
