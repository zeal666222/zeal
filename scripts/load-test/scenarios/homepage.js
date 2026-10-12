// ═══════════════════════════════════════════════════════════════════════════════
// Scenario: Homepage — load test the homepage
// ═══════════════════════════════════════════════════════════════════════════════
// Target: 1000 req/s sustained
// Ramp: 0 → 100 VUs in 1min, hold 3min, ramp down 1min
// ═══════════════════════════════════════════════════════════════════════════════

import http from "k6/http";
import { check, sleep } from "k6";
import { baseUrl, publicHeaders } from "../k6.config.js";

export const options = {
  stages: [
    { duration: "1m", target: 100 }, // ramp up
    { duration: "3m", target: 100 }, // sustain
    { duration: "1m", target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<1500", "p(99)<3000"],
    http_req_failed: ["rate<0.01"],
    http_reqs: ["rate>500"], // expect at least 500 req/s
  },
};

export default function () {
  const res = http.get(`${baseUrl()}/`, {
    headers: publicHeaders(),
    tags: { name: "GET /" },
  });

  check(res, {
    "homepage status 200": (r) => r.status === 200,
    "homepage has content": (r) => r.body.length > 0,
    "homepage < 1.5s": (r) => r.timings.duration < 1500,
  });

  // Simulate user reading the page
  sleep(Math.random() * 3 + 1);

  // Some users also hit the API
  if (Math.random() < 0.3) {
    const apiRes = http.get(`${baseUrl()}/api/consultants/featured`, {
      headers: publicHeaders(),
      tags: { name: "GET /api/consultants/featured" },
    });

    check(apiRes, {
      "featured API 200": (r) => r.status === 200,
    });
  }
}
