// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Horoscope External Sources (free, keyless, open endpoints)
// ═══════════════════════════════════════════════════════════════════════════════
// Every fetch is time-boxed and failure-soft: a dead source never blocks the
// reading — the deterministic ephemeris engine always stands behind it.
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExternalHoroscope {
  source: string;
  text: string;
}

const TIMEOUT_MS = 8_000;

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "ZealBot/1.0 (horoscope aggregation)" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** horoscope-app-api (open-source Vercel app): plain-text daily lines, keyless. */
export async function fetchOpenHoroscopeDaily(sign: string): Promise<ExternalHoroscope | null> {
  const json = await getJson(
    `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${encodeURIComponent(sign)}&day=TODAY`,
  );
  const text = (json as { data?: { horoscope?: unknown } } | null)?.data?.horoscope;
  if (typeof text !== "string" || text.trim().length < 40) return null;
  return { source: "Open daily horoscope feed", text: text.trim() };
}

/** Run all sources in parallel; return whatever answered. */
export async function gatherExternalHoroscopes(sign: string): Promise<ExternalHoroscope[]> {
  const results = await Promise.allSettled([fetchOpenHoroscopeDaily(sign.toLowerCase())]);
  return results
    .filter((r): r is PromiseFulfilledResult<ExternalHoroscope | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is ExternalHoroscope => v !== null);
}
