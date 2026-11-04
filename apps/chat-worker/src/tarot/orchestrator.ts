// Tarot orchestrator — detects tarot intent, draws cards, builds SSE events.
// The ai-chat-handler calls this BEFORE the AI stream; if tarot is detected,
// it injects a tarot_spread event into the SSE stream and enriches the AI
// prompt with the drawn cards so the consultant interprets them.

import { detectTarotIntent, pickSpread, drawCards, type WorkerDrawnCard, type SpreadKey } from "./tarot-deck";

export interface TarotSpreadPayload {
  spread: SpreadKey;
  spreadName: string;
  cards: Array<{
    id: string;
    name: string;
    arcana: "major" | "minor";
    suit?: string;
    symbol: string;
    keywords: string[];
    upright: string;
    reversed: string;
    guidance: string;
    isReversed: boolean;
    position: string;
  }>;
  userMessage: string;
}

export function buildTarotSSEEvent(payload: TarotSpreadPayload) {
  return {
    type: "tarot_spread",
    spread: payload.spread,
    spreadName: payload.spreadName,
    cards: payload.cards,
    userMessage: payload.userMessage,
  };
}

export function buildTarotPromptDirective(payload: TarotSpreadPayload): string {
  const cardLines = payload.cards.map((c) => {
    const orientation = c.isReversed ? "REVERSED" : "upright";
    return `• ${c.position}: ${c.name} (${orientation}) — ${c.isReversed ? c.reversed : c.upright}`;
  }).join("\n");

  return `\n\n[TAROT SPREAD DRAWN — interpret these cards for the seeker]
Spread: ${payload.spreadName}
Cards drawn:
${cardLines}

INSTRUCTIONS: You have just drawn these cards for the seeker. Weave their meanings naturally into your response — name each card and its position, explain what it reveals, and connect the cards into a coherent narrative. Keep it conversational, not clinical. The seeker chose to ask about tarot, so honour that with a real, specific reading. Do NOT just list meanings — tell a story with the cards.`;
}

export interface TarotDetectionResult {
  detected: boolean;
  payload?: TarotSpreadPayload;
}

export function detectAndDrawTarot(userMessage: string): TarotDetectionResult {
  if (!detectTarotIntent(userMessage)) return { detected: false };

  const spreadKey = pickSpread(userMessage);
  const spread = { single: { name: "Single Card", count: 1, positions: ["Guidance"] }, three: { name: "Three-Card Spread", count: 3, positions: ["Past", "Present", "Future"] }, love: { name: "Love Spread", count: 5, positions: ["You", "Your Partner", "The Bond", "Challenge", "Outcome"] }, celtic: { name: "Celtic Cross", count: 5, positions: ["Present", "Challenge", "Subconscious", "Recent Past", "Possible Future"] } } as const;
  const spreadDef = spread[spreadKey];
  const drawn = drawCards(spreadDef.count, [...spreadDef.positions]);

  const payload: TarotSpreadPayload = {
    spread: spreadKey,
    spreadName: spreadDef.name,
    cards: drawn.map((d: WorkerDrawnCard) => ({
      id: d.card.id,
      name: d.card.name,
      arcana: d.card.arcana,
      suit: d.card.suit,
      symbol: d.card.symbol,
      keywords: d.card.keywords,
      upright: d.card.upright,
      reversed: d.card.reversed,
      guidance: d.card.guidance,
      isReversed: d.isReversed,
      position: d.position,
    })),
    userMessage,
  };

  return { detected: true, payload };
}
