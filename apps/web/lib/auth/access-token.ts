// apps/web/lib/auth/access-token.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Resolve the caller's Supabase access token from a Route Handler.
//
// @supabase/ssr's SessionStore refuses to hydrate on Vercel's route-handler
// cookie adapter, so `getSession()` routinely returns null for a user who is
// demonstrably signed in (getUser() succeeds via the JWT in the cookie). Every
// server-side call to a Cloudflare worker needs a bearer to present, so this is
// shared by the chat proxy, the conversation routes and the intake route.
//
// Cookie layout has moved twice, so all known shapes are tried in order:
//   * `sb-<ref>-auth-token`  current: whole session JSON split into `.0`, `.1`,
//                            … chunks. The FIRST chunk is prefixed `base64-`,
//                            the rest are raw base64 continuations.
//   * an older variant used `<byteLength>|<payload>~` length-prefixed framing.
//   * `sb-<ref>-access-token` legacy: raw session JSON, sometimes base64,
//                            sometimes the bare JWT.
// ═══════════════════════════════════════════════════════════════════════════════

import { cookies } from "next/headers";

const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function projectRefFromUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  try {
    return new URL(url).hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

function extractTokenFromValue(value: string): string | null {
  if (JWT_RE.test(value)) return value;

  let text = value;
  if (text.startsWith("base64-")) {
    let b64 = text.slice(7).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    try { text = atob(b64); } catch { return null; }
  }
  if (JWT_RE.test(text)) return text;
  try {
    const obj = JSON.parse(text) as { access_token?: string };
    return obj.access_token ?? null;
  } catch {
    return null;
  }
}

/** Best-effort read of the access token straight out of the cookie jar. */
export async function readAccessTokenFromCookieJar(): Promise<string | null> {
  const ref = projectRefFromUrl();
  if (!ref) return null;
  const jar = Object.fromEntries((await cookies()).getAll().map((c) => [c.name, c.value]));

  const bases = [`sb-${ref}-auth-token`, `sb-${ref}-access-token`];
  for (const base of bases) {
    const candidates: string[] = [];
    if (jar[base]) candidates.push(jar[base]);

    const chunkNames = Object.keys(jar)
      .filter((k) => k.startsWith(`${base}.`))
      .map((k) => ({ name: k, idx: Number(k.slice(base.length + 1)) }))
      .filter((c) => Number.isFinite(c.idx))
      .sort((a, b) => a.idx - b.idx);

    if (chunkNames.length) {
      let b64Joined = "";
      let ok1 = true;
      for (const { name, idx } of chunkNames) {
        let raw = jar[name] ?? "";
        if (idx === 0 && raw.startsWith("base64-")) raw = raw.slice(7);
        else if (idx !== 0 && raw.startsWith("base64-")) { ok1 = false; break; }
        b64Joined += raw;
      }
      if (ok1 && b64Joined) candidates.push("base64-" + b64Joined);

      let lpJoined = "";
      let ok2 = true;
      for (const { name } of chunkNames) {
        const raw = jar[name] ?? "";
        const sep = raw.indexOf("|");
        if (sep < 0) { ok2 = false; break; }
        const payload = raw.slice(sep + 1);
        lpJoined += payload.endsWith("~") ? payload.slice(0, -1) : payload;
      }
      if (ok2 && lpJoined) candidates.push(lpJoined);
    }

    for (const c of candidates) {
      const tok = extractTokenFromValue(c);
      if (tok) return tok;
    }
  }
  return null;
}

export interface WorkerAuth {
  userId: string;
  accessToken: string;
  /** Populated when getUser() succeeded but the token could not be recovered. */
  authError?: string;
}

/**
 * Signed-in identity plus a bearer to hand a worker.
 *
 * Returns `{ userId, accessToken: null }` when the user is real but no token
 * can be recovered — the caller decides whether that is a 503 ("session is
 * warming up") or a 401.
 */
export async function resolveWorkerAuth(): Promise<WorkerAuth | { userId: null; accessToken: null }> {
  const { createServerClientFromCookies } = await import("@zeal/database/server");
  const supabase = await createServerClientFromCookies();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user) return { userId: null, accessToken: null };

  let accessToken: string | null | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token;
  } catch (e) {
    console.warn("[access-token] getSession threw:", e instanceof Error ? e.message : e);
  }

  if (!accessToken) accessToken = await readAccessTokenFromCookieJar();
  return {
    userId: user.id,
    accessToken: accessToken ?? null,
    ...(error ? { authError: error.message } : {}),
  };
}
