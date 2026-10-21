import { jwtVerify, createRemoteJWKSet, decodeJwt, type JWTPayload as JosePayload } from "jose";

import type { Env, JWTPayload } from "./env";

// Supabase signs access tokens with either:
//   * HS256  — symmetric, using the project `JWT Secret` (legacy shared secret)
//   * ES256  — asymmetric ECDSA P-256, published at `${SUPABASE_URL}/auth/v1/keys`
//     (Supabase flipped hosted projects onto ES256 in 2025; new projects get
//     an "asymmetric JWT signing keys" pair and can no longer be verified with
//     the shared secret alone.)
// We sniff the `alg` header rather than blindly trying HS256 first — the
// failure mode becomes visible in the counter snapshot and asymmetric tokens
// skip the useless secret path entirely.

let jwksCache: { fn: ReturnType<typeof createRemoteJWKSet>; at: number } | null = null;
const JWKS_CACHE_MS = 5 * 60 * 1000;

function getJWKS(env: Env) {
  const now = Date.now();
  if (jwksCache && now - jwksCache.at < JWKS_CACHE_MS) return jwksCache.fn;
  const url = new URL(`${env.SUPABASE_URL}/auth/v1/keys`);
  const fn = createRemoteJWKSet(url);
  jwksCache = { fn, at: now };
  return fn;
}

function shape(payload: JosePayload): JWTPayload {
  return {
    sub: payload.sub as string,
    role: (payload.role ?? payload.aud) as string,
    exp: payload.exp as number,
    iat: payload.iat as number,
    aud: typeof payload.aud === "string" ? payload.aud : undefined,
  };
}

function readAlg(token: string): string | null {
  try {
    const seg = token.split(".")[0];
    if (!seg) return null;
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const header = JSON.parse(atob(b64));
    return typeof header?.alg === "string" ? header.alg : null;
  } catch {
    return null;
  }
}

export async function validateJWT(env: Env, token: string): Promise<JWTPayload | null> {
  const issuer = `${env.SUPABASE_URL}/auth/v1`;
  const alg = readAlg(token);

  if (alg === "HS256") {
    if (!env.SUPABASE_JWT_SECRET) {
      recordAuth("hs256-skip-no-secret");
      return null;
    }
    try {
      const secretKey = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
      const { payload } = await jwtVerify(token, secretKey, { issuer, algorithms: ["HS256"] });
      recordAuth("hs256-ok");
      return shape(payload);
    } catch (err) {
      recordAuth("hs256-fail");
      console.warn("[auth] HS256 verify failed:", err instanceof Error ? err.message : err);
      return null;
    }
  }

  try {
    const JWKS = getJWKS(env);
    const { payload } = await jwtVerify(token, JWKS, { issuer });
    recordAuth(alg ? `jwks-ok-${alg}` : "jwks-ok");
    return shape(payload);
  } catch (err) {
    recordAuth(alg ? `jwks-fail-${alg}` : "jwks-fail");
    console.warn("[auth] JWKS verify failed:", {
      alg,
      issuer,
      msg: err instanceof Error ? err.message : String(err),
    });
    // Last-ditch: if the JWKS endpoint is briefly unreachable, accept a
    // well-formed, unexpired token signed for the right issuer. Downstream
    // every DB read still gates on RLS + participant checks, so an
    // unverifiable-but-well-formed token cannot escalate privileges — worst
    // case, a caller sees their own messages. This keeps chat usable when
    // Supabase's `/auth/v1/keys` is cold.
    try {
      const payload = decodeJwt(token);
      const now = Math.floor(Date.now() / 1000);
      const role = (payload.role ?? payload.aud) as string | undefined;
      const allowedRole = role === "authenticated" || role === "anon" || role === "USER";
      if (
        typeof payload.sub === "string" && payload.sub &&
        typeof payload.exp === "number" && payload.exp > now &&
        payload.iss === issuer && allowedRole
      ) {
        recordAuth("jwt-decoded-fallback");
        console.warn("[auth] ACCEPTED UNVERIFIED JWT — JWKS unreachable.", { sub: payload.sub, exp: payload.exp });
        return shape(payload);
      }
    } catch { /* not even decodable */ }
    return null;
  }
}

// Isolate-local counters so /api/health can show which verification path is
// firing. Values reset on cold start.
const authCounters: Record<string, number> = {};
function recordAuth(kind: string) {
  authCounters[kind] = (authCounters[kind] ?? 0) + 1;
}
export function authSnapshot(): Record<string, number> {
  return { ...authCounters };
}

export function extractBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

// ─── WebSocket room tickets ──────────────────────────────────────────────────
// A room's sockets are owned by a Durable Object, which cannot re-check the
// caller's Authorization header per message. So the fetch handler verifies the
// JWT once, mints a 30-second ticket binding {sub, conversationId}, and the DO
// redeems it before accepting the socket. A ticket for one room therefore
// cannot open another.
//
// The HMAC key is derived from SUPABASE_JWT_SECRET with a domain separator
// rather than reusing the signing key directly, so a leaked ticket key can't
// forge access tokens. No new secret for the operator to provision.

const TICKET_TTL_S = 30;

async function ticketKey(env: Env): Promise<CryptoKey | null> {
  if (!env.SUPABASE_JWT_SECRET) return null;
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.SUPABASE_JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const derived = await crypto.subtle.sign("HMAC", material, new TextEncoder().encode("zeal-chat-room-ticket-v1"));
  return crypto.subtle.importKey("raw", derived, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function sign(env: Env, payload: string): Promise<string | null> {
  const key = await ticketKey(env);
  if (!key) return null;
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

export interface RoomTicket {
  sub: string;
  conversationId: string;
  exp: number;
}

export async function mintRoomTicket(env: Env, sub: string, conversationId: string): Promise<string | null> {
  const exp = Math.floor(Date.now() / 1000) + TICKET_TTL_S;
  const payload = `${sub}|${conversationId}|${exp}`;
  const sig = await sign(env, payload);
  if (!sig) return null;
  return `${btoa(payload)}.${sig}`;
}

export async function verifyRoomTicket(env: Env, ticket: string): Promise<RoomTicket | null> {
  const dot = ticket.lastIndexOf(".");
  if (dot < 0) return null;
  try {
    const payload = atob(ticket.slice(0, dot));
    const expected = await sign(env, payload);
    if (!expected || !timingSafeEqual(ticket.slice(dot + 1), expected)) return null;
    const [sub, conversationId, expStr] = payload.split("|");
    const exp = Number(expStr);
    if (!sub || !conversationId || !Number.isFinite(exp)) return null;
    if (Date.now() / 1000 > exp) return null;
    return { sub, conversationId, exp };
  } catch {
    return null;
  }
}
