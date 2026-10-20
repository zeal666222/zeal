import type { Env, Principal } from "./env";
import { ADMIN_ROLES } from "./env";

// Admin token verification WITHOUT handling the Supabase JWT signing secret.
// We let Supabase itself validate the access token by hitting its userinfo
// endpoint (`/auth/v1/user`) — no secret material leaves the platform, and the
// role is read from the authoritative app_metadata on the response. This needs
// only the public project URL.

export function extractBearer(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

const authCounters: Record<string, number> = {};
function record(kind: string) { authCounters[kind] = (authCounters[kind] ?? 0) + 1; }
export function authSnapshot(): Record<string, number> { return { ...authCounters }; }

export async function authenticateToken(env: Env, token: string): Promise<Principal | null> {
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) { record("no-token"); return null; }
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
      cf: { cacheTtl: 0 },
    });
    if (!res.ok) { record("userinfo-denied"); return null; }
    const data = (await res.json()) as {
      id?: string;
      app_metadata?: { role?: string };
      aud?: string;
    };
    const role = data?.app_metadata?.role ?? "";
    if (!data?.id) { record("userinfo-no-sub"); return null; }
    record("userinfo-ok");
    return { sub: data.id, role: String(role).toUpperCase(), exp: Math.floor(Date.now() / 1000) + 3600 };
  } catch (e) {
    record("userinfo-error");
    console.warn("[auth] userinfo failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export function isAdmin(principal: Principal | null): principal is Principal {
  return !!principal && ADMIN_ROLES.has(String(principal.role).toUpperCase());
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// ── Ingest authorization ─────────────────────────────────────────────────────
// The Next.js app calls /ingest server-side and already holds the Supabase
// service-role key. Rather than provision a second shared secret, we validate
// that key against Supabase itself: only a service-role key can reach the GoTrue
// admin endpoint (`/auth/v1/admin/users`) — the anon key gets rejected. The
// worker stores NO copy of the key; it caches the allow/deny decision for a
// short window (keyed by a hash) so frequent event pushes don't add a round-trip.

const ingestCache = new Map<string, { ok: boolean; at: number }>();
const INGEST_TTL_MS = 5 * 60 * 1000;

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function authorizeIngest(req: Request, env: Env): Promise<boolean> {
  const bearer = extractBearer(req);
  if (!bearer || !env.SUPABASE_URL) { record("ingest-no-key"); return false; }

  const tokenHash = await sha256Hex(bearer);
  const cached = ingestCache.get(tokenHash);
  if (cached && Date.now() - cached.at < INGEST_TTL_MS) return cached.ok;

  let ok = false;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?per_page=1`, {
      method: "GET",
      headers: { Authorization: `Bearer ${bearer}`, apikey: bearer },
    });
    ok = res.ok; // 200 only for a service-role key
    record(ok ? "ingest-service-ok" : "ingest-service-denied");
  } catch (e) {
    record("ingest-service-error");
    console.warn("[auth] ingest validation failed:", e instanceof Error ? e.message : e);
    ok = false;
  }
  // Bound the cache; drop stale + oldest beyond 64 entries.
  if (ingestCache.size > 64) for (const [k, v] of ingestCache) { if (Date.now() - v.at > INGEST_TTL_MS) ingestCache.delete(k); }
  ingestCache.set(tokenHash, { ok, at: Date.now() });
  return ok;
}

// ── WS upgrade ticket ────────────────────────────────────────────────────────
// The upgrade hands off to the Durable Object which owns the hibernating
// socket, where the original Authorization header is no longer re-checkable per
// message. So the fetch handler authenticates once, then mints a short-lived
// HMAC ticket binding sub|role|exp that the DO re-verifies before accepting.

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function mintTicket(env: Env, principal: Principal): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 30; // survives only the upgrade
  const payload = `${principal.sub}|${principal.role}|${exp}`;
  const sig = await hmac(env.WS_TICKET_SECRET, payload);
  return `${btoa(payload)}.${sig}`;
}

export async function verifyTicket(env: Env, ticket: string): Promise<Principal | null> {
  const dot = ticket.lastIndexOf(".");
  if (dot < 0 || !env.WS_TICKET_SECRET) return null;
  try {
    const payload = atob(ticket.slice(0, dot));
    const sig = ticket.slice(dot + 1);
    const expected = await hmac(env.WS_TICKET_SECRET, payload);
    if (!timingSafeEqual(sig, expected)) return null;
    const [sub, role, expStr] = payload.split("|");
    const exp = Number(expStr);
    if (!sub || Date.now() / 1000 > exp) return null;
    return { sub, role, exp };
  } catch {
    return null;
  }
}
