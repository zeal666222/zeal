// Fetch wrapper for the free-service AI endpoints.
// The provider fallback chain can exhaust its circuit-breaker warm-up on a
// cold server and answer 503 {retryable:true}; one transparent retry after a
// short pause almost always lands on a now-warm provider.
export async function fetchAIJson<T = unknown>(
  input: string,
  init: RequestInit,
): Promise<{ res: Response; data: T | null }> {
  let res = await fetch(input, init);
  if (!res.ok && (res.status === 429 || res.status === 503 || res.status >= 500)) {
    let retryable = true;
    try {
      const body = (await res.clone().json()) as { retryable?: boolean };
      retryable = body?.retryable !== false;
    } catch { /* non-JSON error — assume retryable */ }
    if (retryable) {
      await new Promise((r) => setTimeout(r, 1500));
      res = await fetch(input, init);
    }
  }
  const data = res.ok ? ((await res.json().catch(() => null)) as T | null) : null;
  return { res, data };
}
