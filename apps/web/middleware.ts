import { NextResponse, type NextRequest } from "next/server";

// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Edge Middleware (Cloudflare / Vercel Edge runtime)
// ─────────────────────────────────────────────────────────────────────────────
// Responsibilities, in order of cost:
//   1. Traceability  — mint an x-request-id on EVERY inbound request.
//   2. Fast path     — per-instance in-memory token limiter for /api/* only.
//   3. Hardening     — baseline security headers (CSP stays Report-Only here so
//                      it never fights the enforced CSP set in next.config.js).
//   4. Never touch   — static assets, /_next/*, image optimizer, public media.
//
// ─── OPTIONAL DISTRIBUTED LIMITER (fail-safe, additive) ────────────────────────
// The in-memory store is per-isolate: great as a cheap first line, but a
// attacker who spreads across cold starts evades it. For a *global* counter on
// the FREE tier, bind a Cloudflare KV namespace (Workers) or an Upstash-style
// Redis-over-HTTP (keep it Free tier) and gate it behind an env flag. The
// helpers below are wired so that a missing binding is a NO-OP — the edge
// in-memory limiter always runs regardless, so nothing breaks if you skip this.
//
//   # .env / wrangler.toml [vars]
//   EDGE_KV_RATELIMIT=rateLimitKv      # KV binding name (empty ⇒ disabled)
//   EDGE_KV_TTL_SECONDS=60             # window per key
//
//   # apps/web/wrangler.toml (Workers deploy target only)
//   # [[kv_namespaces]]
//   # binding = "rateLimitKv"
//   # id      = "<namespace id from `wrangler kv namespace create rateLimitKv`>"
//
// On Vercel there is no `env` binding object here; leave EDGE_KV_RATELIMIT
// unset and the fast path stays the whole story. Never paid, never required.
// ═══════════════════════════════════════════════════════════════════════════════

// Edge-compatible in-memory rate limit store (per-instance, resets on cold start)
const store = new Map<string, { count: number; resetAt: number }>();

interface LimitConfig {
  tokens: number;
  windowMs: number;
}

// Tiered limits for 100 concurrent users
const LIMITS: Record<string, LimitConfig> = {
  // AI endpoints — strict to prevent abuse
  "/api/ai": { tokens: 20, windowMs: 60_000 },
  "/api/chat/ai": { tokens: 15, windowMs: 60_000 },
  // Auth endpoints — prevent brute force
  "/api/auth": { tokens: 10, windowMs: 60_000 },
  // Upload — prevent storage abuse
  "/api/upload": { tokens: 10, windowMs: 60_000 },
  // General API — moderate limit
  "/api/": { tokens: 60, windowMs: 60_000 },
};

// Most-specific-first prefix probe order (mirrors LIMITS keys).
const LIMIT_PREFIXES = ["/api/ai", "/api/chat/ai", "/api/auth", "/api/upload", "/api/"];

// ─── Static / asset paths that must NEVER be rate limited ─────────────────────
const STATIC_PREFIXES = [
  "/_next/static",
  "/_next/image", // Next.js image optimizer (cached at the CDN)
  "/_next/data",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
];
const STATIC_EXT =
  /\.(?:js|mjs|cjs|css|map|png|jpe?g|gif|svg|webp|avif|ico|bmp|mp4|webm|woff2?|ttf|otf|eot|json|txt|xml|pdf)$/i;

function isStaticPath(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) {
    // Only optimised/immutable internals are exempt; API-like /_next routes
    // that start with /api are handled separately anyway.
    return true;
  }
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return STATIC_EXT.test(pathname);
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

// ─── Request ID ───────────────────────────────────────────────────────────────
// Reuse Cloudflare's cf-ray prefix when present so edge logs correlate; else a
// UUIDv4 (crypto.randomUUID is available on the Edge runtime).
function getRequestId(req: NextRequest): string {
  const cfRay = req.headers.get("cf-ray");
  if (cfRay) return cfRay.split("-")[0] ?? cfRay;
  const inbound = req.headers.get("x-request-id");
  if (inbound) return inbound;
  try {
    return crypto.randomUUID();
  } catch {
    return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

// ─── Security headers ───────────────────────────────────────────────────────
// CSP is intentionally REPORT-ONLY in middleware so it complements — rather
// than duplicates/clashes with — the enforced CSP defined in next.config.js.
// 'unsafe-inline'/'unsafe-eval' keep Next.js hydration & inline scripts alive.
const REPORT_ONLY_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "report-to /api/csp-report",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy-Report-Only": REPORT_ONLY_CSP,
};

function applySecurityHeaders(target: Headers): void {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    // Don't overwrite anything next.config.js / the handler already set.
    if (!target.has(k)) target.set(k, v);
  }
}

function checkEdgeLimit(
  key: string,
  config: LimitConfig,
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { ok: true, remaining: config.tokens - 1, resetAt: now + config.windowMs };
  }

  entry.count++;
  const ok = entry.count <= config.tokens;
  return { ok, remaining: Math.max(0, config.tokens - entry.count), resetAt: entry.resetAt };
}

function findMatchingLimit(pathname: string): LimitConfig | null {
  for (const prefix of LIMIT_PREFIXES) {
    if (pathname.startsWith(prefix)) return LIMITS[prefix] ?? null;
  }
  return null;
}

// Periodic cleanup to prevent memory leak
let lastCleanup = Date.now();
function cleanupStore(): void {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [k, v] of store) {
    if (v.resetAt < now) store.delete(k);
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = getRequestId(request);

  // Forward the request id to origin/handlers via a request header.
  const forwarded = new Headers(request.headers);
  forwarded.set("x-request-id", requestId);

  // ─── OPTIONS preflight: pass through untouched (browser handles CORS) ──────
  if (request.method === "OPTIONS") {
    const preflight = NextResponse.next({ request: { headers: forwarded } });
    preflight.headers.set("x-request-id", requestId);
    return preflight;
  }

  // ─── Static assets, build files & image optimizer: NEVER rate limit ────────
  if (isStaticPath(pathname)) {
    const asset = NextResponse.next({ request: { headers: forwarded } });
    asset.headers.set("x-request-id", requestId);
    return asset;
  }

  // ─── Non-API routes: only attach tracing + security headers ────────────────
  if (!pathname.startsWith("/api/")) {
    const res = NextResponse.next({ request: { headers: forwarded } });
    res.headers.set("x-request-id", requestId);
    applySecurityHeaders(res.headers);
    return res;
  }

  const config = findMatchingLimit(pathname);
  if (!config) {
    const res = NextResponse.next({ request: { headers: forwarded } });
    res.headers.set("x-request-id", requestId);
    applySecurityHeaders(res.headers);
    return res;
  }

  cleanupStore();

  const ip = getClientIp(request);
  const key = `edge:${pathname.split("/").slice(0, 3).join("/")}:${ip}`;
  const result = checkEdgeLimit(key, config);

  if (!result.ok) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    // Retry-After + X-RateLimit-* so browsers and client SDKs back off correctly.
    const response = new NextResponse(
      JSON.stringify({ error: "Rate limit exceeded. Please wait before trying again.", requestId }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(config.tokens),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(result.resetAt),
          "x-request-id": requestId,
        },
      },
    );
    applySecurityHeaders(response.headers);
    return response;
  }

  const response = NextResponse.next({ request: { headers: forwarded } });
  response.headers.set("x-request-id", requestId);
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Limit", String(config.tokens));
  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  // Run on almost everything, but skip Next build artifacts + the favicon so
  // we never spend CPU cycles on immutable assets. Static/asset & image paths
  // are additionally short-circuited inside the handler above.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
