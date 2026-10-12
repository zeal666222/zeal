// ═══════════════════════════════════════════════════════════════════════════════
// Scenario: Chat — simulate AI chat conversations
// ═══════════════════════════════════════════════════════════════════════════════
// Target: 100 concurrent conversations
// Each VU simulates a multi-turn conversation with an AI consultant
// ═══════════════════════════════════════════════════════════════════════════════

import http from "k6/http";
import { check, sleep } from "k6";
import { baseUrl, authHeaders, randomId, randomPick } from "../k6.config.js";

export const options = {
  stages: [
    { duration: "2m", target: 20 },  // ramp up
    { duration: "6m", target: 20 },  // sustain conversations
    { duration: "2m", target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<5000", "p(99)<15000"], // AI responses can be slow
    http_req_failed: ["rate<0.05"],
  },
};

const MESSAGES = [
  "Hi, I need guidance on my career.",
  "What does my birth chart say about relationships?",
  "I'm feeling lost lately. Can you help?",
  "What's my lucky number this week?",
  "Tell me about my compatibility with my partner.",
  "When is a good time to start a new business?",
  "How can I improve my health according to astrology?",
  "What remedies can help with financial problems?",
  "What does Mercury retrograde mean for me?",
  "Can you read my palm lines?",
];

export default function () {
  const conversationId = randomId();
  const consultantId = "test-ai-consultant-id"; // Replace with real AI consultant ID

  // Simulate a multi-turn conversation (3-8 messages)
  const turns = Math.floor(Math.random() * 6) + 3;

  for (let i = 0; i < turns; i++) {
    const message = randomPick(MESSAGES);

    const res = http.post(
      `${baseUrl()}/api/chat/ai/${consultantId}`,
      JSON.stringify({
        conversationId,
        content: message,
      }),
      {
        headers: authHeaders(),
        tags: { name: `POST /api/chat/ai (turn ${i + 1})` },
        timeout: "15s",
      },
    );

    check(res, {
      "chat response received": (r) => r.status === 200 || r.status === 429,
      "chat not 500": (r) => r.status < 500,
    });

    // If rate limited, back off
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers["Retry-After"] || "5", 10);
      sleep(retryAfter);
      continue;
    }

    // Simulate reading time between messages
    sleep(Math.random() * 5 + 2);
  }
}
