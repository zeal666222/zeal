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

const CSP = [
  "default-src 'self'",
  `img-src 'self' data: blob: https://*.r2.dev https://*.supabase.co https://ui-avatars.com https://images.unsplash.com https://picsum.photos https://lh3.googleusercontent.com ${imageHosts.join(" ")}`,
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel.app https://api.groq.com https://apihub.agnes-ai.com https://vitals.vercel-insights.com",
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
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
  },
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Immutable, content-hashed build assets — cache aggressively at the
        // edge (Cloudflare/CDN) and in the browser.
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Next.js image optimizer output is keyed by source URL + params, so it
        // is safe to cache long-term.
        source: "/_next/image",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Hashed public media (avatars, post thumbnails) served from /public.
        source: "/media/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
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
