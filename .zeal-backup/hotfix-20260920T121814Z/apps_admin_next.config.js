/** @type {import('next').NextConfig} */

// Admin CSP is stricter than web: no camera/microphone (chat-only portal),
// frame-ancestors DENY, and no third-party script origins beyond Supabase.
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://*.r2.dev https://*.supabase.co https://ui-avatars.com https://images.unsplash.com https://picsum.photos https://lh3.googleusercontent.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel.app https://zeal-web-red.vercel.app https://api.groq.com https://apihub.agnes-ai.com https://vitals.vercel-insights.com",
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
  { key: "X-Frame-Options",           value: "DENY" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "Referrer-Policy",           value: "no-referrer" },
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig = {
  serverExternalPackages: ["server-only"],
  reactStrictMode: true,
  transpilePackages: ["@zeal/ui", "@zeal/types", "@zeal/database", "@zeal/utils", "@zeal/realtime"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  poweredByHeader: false,
  compress: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://zeal-web-red.vercel.app/api/:path*",
      },
    ];
  },
  turbopack: { root: __dirname },
};

nextConfig.headers = async () => [
  { source: "/(.*)", headers: securityHeaders },
];

module.exports = nextConfig;
