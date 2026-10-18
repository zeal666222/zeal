import { createRemoteJWKSet, jwtVerify, type JWTPayload as JosePayload } from "jose";

import type { Env, JWTPayload } from "./env";

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

export async function validateJWT(env: Env, token: string): Promise<JWTPayload | null> {
  try {
    const JWKS = getJWKS(env);
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
    });
    return {
      sub: payload.sub as string,
      role: (payload.role ?? payload.aud) as string,
      exp: payload.exp as number,
      iat: payload.iat as number,
      aud: typeof payload.aud === "string" ? payload.aud : undefined,
    };
  } catch {
    return null;
  }
}

export function extractBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}
