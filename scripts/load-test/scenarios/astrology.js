// ═══════════════════════════════════════════════════════════════════════════════
// Scenario: Astrology — compute astrology charts
// ═══════════════════════════════════════════════════════════════════════════════
// Target: 300 chart computations/s (or as many as the worker can handle)
// Tests the astro-worker Cloudflare Worker and interpretation pipeline
// ═══════════════════════════════════════════════════════════════════════════════

import http from "k6/http";
import { check, sleep } from "k6";
import { baseUrl, authHeaders, randomPick } from "../k6.config.js";

export const options = {
  stages: [
    { duration: "1m", target: 30 },
    { duration: "3m", target: 30 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<5000", "p(99)<10000"],
    http_req_failed: ["rate<0.05"],
  },
};

// Realistic birth data for testing
const BIRTH_DATA = [
  { date: "1990-05-15", time: "06:30", place: "Mumbai, India", lat: 19.076, lng: 72.8777 },
  { date: "1985-12-25", time: "14:00", place: "Delhi, India", lat: 28.6139, lng: 77.209 },
  { date: "1995-03-08", time: "22:15", place: "Bangalore, India", lat: 12.9716, lng: 77.5946 },
  { date: "1988-07-20", time: "03:45", place: "Chennai, India", lat: 13.0827, lng: 80.2707 },
  { date: "1992-11-02", time: "10:00", place: "Kolkata, India", lat: 22.5726, lng: 88.3639 },
  { date: "1987-01-30", time: "18:30", place: "Pune, India", lat: 18.5204, lng: 73.8567 },
  { date: "1993-09-14", time: "08:00", place: "Hyderabad, India", lat: 17.385, lng: 78.4867 },
  { date: "1991-06-22", time: "12:00", place: "Jaipur, India", lat: 26.9124, lng: 75.7873 },
];

export default function () {
  const birth = randomPick(BIRTH_DATA);

  // 1. Compute chart via astro-worker
  const chartRes = http.post(
    `${baseUrl()}/api/astrology/compute`,
    JSON.stringify({
      birthDate: birth.date,
      birthTime: birth.time,
      birthPlace: birth.place,
      latitude: birth.lat,
      longitude: birth.lng,
      chartType: "vedic",
    }),
    {
      headers: authHeaders(),
      tags: { name: "POST /api/astrology/compute" },
      timeout: "10s",
    },
  );

  check(chartRes, {
    "chart computed 200": (r) => r.status === 200,
    "chart has data": (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.chart !== undefined || data.interpretation !== undefined;
      } catch {
        return false;
      }
    },
  });

  sleep(Math.random() * 2 + 1);

  // 2. Get interpretation (60% of users ask for interpretation)
  if (Math.random() < 0.6) {
    const interpRes = http.post(
      `${baseUrl()}/api/astrology/interpret`,
      JSON.stringify({
        birthDate: birth.date,
        birthTime: birth.time,
        birthPlace: birth.place,
        timezone: "Asia/Kolkata",
        chartType: "vedic",
        question: randomPick([
          "What does my chart say about my career?",
          "Tell me about my relationships.",
          "When is a good time for marriage?",
          "What are my financial prospects?",
          null, // no specific question
        ]),
      }),
      {
        headers: authHeaders(),
        tags: { name: "POST /api/astrology/interpret" },
        timeout: "15s",
      },
    );

    check(interpRes, {
      "interpretation 200": (r) => r.status === 200,
    });
  }
}
