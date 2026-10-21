/** @type {import('next').NextConfig} */
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL Web — Next.js 16 config
// ─────────────────────────────────────────────────────────────────────────────
// reactCompiler  : React Compiler stable — automatic memoization.
//                  Guarded by require.resolve so a missing workspace dep
//                  does NOT hard-fail the Vercel build.
// cacheComponents: NOT enabled yet — requires removing all `export const dynamic`
//                  route configs across every page. Track as Phase 4.
//
// Monorepo root alignment:
//   Next.js 16 requires `outputFileTracingRoot` and `turbopack.root` to match.
//   Both point at the monorepo root so hoisted workspace deps (@zeal/*,
//   babel-plugin-react-compiler) resolve correctly on Vercel.
// ═══════════════════════════════════════════════════════════════════════════════

const path = require("path");

// ─── React Compiler guard ─────────────────────────────────────────────────────
// Enabled when the plugin resolves from this workspace; silently skipped
// otherwise (with a warning). Runtime behavior is identical when present.
let reactCompiler = false;
try {
  require.resolve("babel-plugin-react-compiler");
  reactCompiler = true;
} catch {
  console.warn(
    "[next.config] babel-plugin-react-compiler not resolvable — " +
    "React Compiler disabled for this build. " +
    "Run `npm install` at the repo root.",
  );
}

const MONOREPO_ROOT = path.join(__dirname, "..", "..");

// Immutable asset caching is a PRODUCTION-ONLY concern. In webpack dev, chunk
// URLs like /_next/static/chunks/app/layout.js carry no ?v= buster and their
// bytes change on every recompile — caching them for a year poisons the
// browser cache (a truncated mid-rebuild stub stays pinned forever and the
// flight parser hangs waiting for the chunk, with no console error).
const IS_PROD = process.env.NODE_ENV === "production";

// ─── Cloudflare / R2 image hosts (added to CSP img-src when configured) ───────
// R2_PUBLIC_URL may be an r2.dev bucket URL or a custom Cloudflare zone; both
// must be allowed for <img> and next/image. imagedelivery.net is allowed for the
// optional Cloudflare Images delivery strategy.
const imageHosts = ["https://imagedelivery.net"];
try {
  const r2Public = process.env.R2_PUBLIC_URL;
  if (r2Public) imageHosts.push(new URL(r2Public).origin);
} catch {
  /* ignore malformed R2_PUBLIC_URL */
}

// ─── Cloudflare worker origins (added to CSP connect-src) ────────────────────
// AI chat rooms, their realtime sockets and the admin bus all live on workers.dev
// unless a custom domain is configured, so both the wildcard and the explicit
// CHAT_WORKER_URL origin are allowed. Without this the socket is blocked in prod.
const connectHosts = ["https://*.workers.dev", "wss://*.workers.dev"];
try {
  const workerUrl = process.env.CHAT_WORKER_URL;
  if (workerUrl) connectHosts.push(new URL(workerUrl).origin);
} catch {
  /* ignore malformed CHAT_WORKER_URL */
}

const CSP = [
  "default-src 'self'",
  `img-src 'self' data: blob: https://*.r2.dev https://*.supabase.co https://ui-avatars.com https://images.unsplash.com https://picsum.photos https://lh3.googleusercontent.com ${imageHosts.join(" ")}`,
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel.app https://api.groq.com ${connectHosts.join(" ")} https://vitals.vercel-insights.com`,
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy",   value: CSP },
  { key: "X-Frame-Options",           value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(self), microphone=(self), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig = {
  reactStrictMode: true,
  reactCompiler,
  transpilePackages: ["@zeal/ui", "@zeal/types", "@zeal/database", "@zeal/utils", "@zeal/realtime"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "imagedelivery.net" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    // Seeded/user avatars come from ui-avatars.com as SVG; without this the
    // optimizer answers /_next/image with 400 "image type is not allowed".
    // Output is rasterized to webp/avif (see formats) and served under a
    // script-less sandbox CSP, so raw SVG never reaches the page.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    formats: ["image/avif", "image/webp"],
    // FreeServicesGrid banners ship at quality 82 — must be allow-listed or Next
    // emits `next-image-unconfigured-qualities` warnings on every page load.
    qualities: [75, 82],
    minimumCacheTTL: 31536000,
    // Keep the default Next.js loader (Cloudflare Workers AI / Pages can proxy
    // /_next/image transparently). Long-lived cache directives for the
    // optimizer's responses are applied via the `/_next/image` entry in
    // headers() below — CDN-Cache-Control is what Cloudflare honours at the
    // edge, so both Cloudflare and the browser hold the rendered bytes.
  },
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...(IS_PROD ? [
        {
          // Immutable, content-hashed build assets — cache aggressively at the
          // edge (Cloudflare/CDN) and in the browser. CDN-Cache-Control is what
          // Cloudflare honours for edge caching, so it's set alongside the
          // browser-facing Cache-Control.
          source: "/_next/static/:path*",
          headers: [
            { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
            { key: "CDN-Cache-Control", value: "public, max-age=31536000, immutable" },
            { key: "Cloudflare-CDN-Cache-Control", value: "public, max-age=31536000, immutable" },
          ],
        },
        {
          // Next.js image optimizer output is keyed by source URL + params, so it
          // is safe to cache long-term at the edge.
          source: "/_next/image",
          headers: [
            { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
            { key: "CDN-Cache-Control", value: "public, max-age=31536000, immutable" },
            { key: "Cloudflare-CDN-Cache-Control", value: "public, max-age=31536000, immutable" },
          ],
        },
      ] : []),
      {
        // Hashed public media (avatars, post thumbnails) served from /public.
        source: "/media/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "CDN-Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Static, non-user-specific marketing / service catalog pages. Cached
      // at Cloudflare's edge with soft-revalidation so first paint is instant
      // but content never goes stale by more than ~10 min. Kept PRIVATE-safe:
      // NO `public` on anything under the authed dashboard / account surface.
      // (Next 16 headers sources don't support `(a|b)` alternations — list each.)
      ...["/services", "/astrology", "/ai-astrologers", "/explore", "/sparks"].map(
        (source) => ({
          source,
          headers: [
            { key: "Cache-Control", value: "public, max-age=0, s-maxage=120, stale-while-revalidate=600" },
            { key: "CDN-Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=600" },
            { key: "Vary", value: "Accept-Language, Cookie" },
          ],
        }),
      ),
      // Authenticated / personalised surfaces must never be edge-cached.
      ...["/dashboard", "/profile", "/wallet", "/bookings", "/notifications", "/chat", "/create", "/onboarding", "/u"].map(
        (prefix) => ({
          source: `${prefix}/:path*`,
          headers: [
            { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
            { key: "CDN-Cache-Control", value: "private, no-store" },
          ],
        }),
      ),
    ];
  },
  async redirects() {
    return [
      { source: "/auth/login",     destination: "/login",          permanent: true },
      { source: "/auth/register",  destination: "/register",       permanent: true },
      { source: "/ai-consultants", destination: "/ai-astrologers", permanent: true },
      { source: "/quests",         destination: "/sparks",         permanent: false },
      { source: "/referral",       destination: "/sparks",         permanent: false },
      { source: "/bazaar",         destination: "/explore",        permanent: false },
    ];
  },
  // Monorepo root — must match outputFileTracingRoot so Next can resolve
  // hoisted workspace deps (@zeal/*, babel-plugin-react-compiler).
  outputFileTracingRoot: MONOREPO_ROOT,
  turbopack: { root: MONOREPO_ROOT },
};

module.exports = nextConfig;
