// Reply screening — local, deterministic, no database round-trip.
//
// This used to call Supabase's `check_ai_safety` RPC on every AI turn, which
// made the chat unavailable whenever Supabase was and put the transcript's
// safety gate outside the worker that owns it. The rules are small enough to
// live in code: a per-consultant blocklist from D1 plus a platform floor.
import type { PersonaContext } from "./persona-loader";

const REDIRECT = "I sense this is outside what I can guide on. Let me redirect — what else is on your mind?";

/**
 * Platform floor. Deliberately about *claims* rather than topics: astrology
 * legitimately discusses death, illness, breakup and intimacy, so the filter
 * fires on absolutes and instructions, not on vocabulary.
 */
const PLATFORM_PATTERNS: RegExp[] = [
  // Harm instructions — the seeker's own safety comes first.
  /(?:how to|here(?:'s|s) (?:how )?to)\s+(?:kill (?:myself|yourself)|end (?:it all|my life)|poison|overdose)/i,
  /(?:suicide|self[- ]?harm)\s+(?:method|how|steps|plan)/i,
  // Medical diagnosis dressed as a reading.
  /you (?:have|are suffering from)\s+(?:cancer|hiv|aids|tuberculosis|schizophrenia)/i,
  /(?:this means|confirmed:?)\s+you will (?:die|get (?:cancer|aids))/i,
  // Illegal / harm trades offered through the consultation.
  /(?:black magic|tantra)\s+(?:to (?:kill|hurt|destroy)|service|contact)/i,
  /(?:bring back|force)\s+(?:an ex|someone)\s+back with (?:spell|black)/i,
  // Financial absolutes.
  /guaranteed (?:lottery|returns|profit|jackpot)|fix(?:ed)? (?:match|lottery) numbers?/i,
];

interface Compiled {
  re: RegExp;
  source: "platform" | "consultant";
}

function compileConsultantPatterns(raw: string[]): Compiled[] {
  const out: Compiled[] = [];
  for (const pattern of raw) {
    if (!pattern || typeof pattern !== "string") continue;
    try {
      out.push({ re: new RegExp(pattern, "i"), source: "consultant" });
    } catch {
      // A malformed regex in a super-admin-edited row must not take the chat
      // down; that pattern is simply not enforced.
      console.warn("[moderation] invalid banned pattern skipped:", pattern.slice(0, 60));
    }
  }
  return out;
}

export interface ScreeningResult {
  safe: boolean;
  text: string;
  matched?: string;
}

export function screenReply(text: string, persona: Pick<PersonaContext, "bannedPatterns">): ScreeningResult {
  const consultant = compileConsultantPatterns(persona.bannedPatterns ?? []);
  for (const { re, source } of [...PLATFORM_PATTERNS.map((r) => ({ re: r, source: "platform" as const })), ...consultant]) {
    if (re.test(text)) {
      console.warn(`[moderation] ${source} pattern blocked a reply`);
      return { safe: false, text: REDIRECT, matched: re.source };
    }
  }
  return { safe: true, text };
}

export const SAFETY_REDIRECT = REDIRECT;
