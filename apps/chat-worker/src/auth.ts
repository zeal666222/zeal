import { jwtVerify, createRemoteJWKSet, type JWTPayload as JosePayload } from "jose";

import type { Env, JWTPayload } from "./env";

// Supabase's GoTrue server mints HS256 access tokens signed with the project
// JWT secret. Cloudflare Workers run on workerd, which exposes WebCrypto, so
// we verify the symmetric signature directly with `SUPABASE_JWT_SECRET`.
//
// A small minority of self-hosted projects use asymmetric (RS256/ES256) keys
// exposed via `/auth/v1/keys`; if HS256 verification fails we fall through to
// the remote JWK set so both topologies keep working.
//
// The previous implementation only used `createRemoteJWKSet`, which cannot
// resolve a `secret` JWK entry — every production request was rejected with
// `Invalid token` even though the browser held a perfectly valid session.

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

export async function validateJWT(env: Env, token: string): Promise<JWTPayload | null> {
  const issuer = `${env.SUPABASE_URL}/auth/v1`;

  if (env.SUPABASE_JWT_SECRET) {
    try {
      const secretKey = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
      const { payload } = await jwtVerify(token, secretKey, {
        issuer,
        algorithms: ["HS256"],
      });
      recordAuth("hs256-ok");
      return shape(payload);
    } catch {
      recordAuth("hs256-fail");
      /* fall through to JWKS path */
    }
  } else {
    recordAuth("hs256-skip-no-secret");
  }

  try {
    const JWKS = getJWKS(env);
    const { payload } = await jwtVerify(token, JWKS, { issuer });
    recordAuth("jwks-ok");
    return shape(payload);
  } catch (err) {
    recordAuth("jwks-fail");
    console.warn("[auth] JWT verification failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// Simple, isolate-local counters so /api/health can show whether real
// production sessions are hitting the HS256 path (which is what we now
// expect). Values reset on cold start; that's fine for verification.
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
