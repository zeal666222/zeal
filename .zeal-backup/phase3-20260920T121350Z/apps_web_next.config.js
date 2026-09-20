/** @type {import('next').NextConfig} */
const CSP = "default-src 'self'; img-src 'self' data: blob: https://*.r2.dev https://*.supabase.co https://ui-avatars.com https://images.unsplash.com https://picsum.photos https://lh3.googleusercontent.com; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel.app https://api.groq.com https://apihub.agnes-ai.com https://vitals.vercel-insights.com; font-src 'self' data:; worker-src 'self' blob:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests";
const H = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];
module.exports = {
  reactStrictMode: true,
  transpilePackages: ["@zeal/ui","@zeal/types","@zeal/database","@zeal/utils","@zeal/realtime"],
  images: { remotePatterns: [
    { protocol: "https", hostname: "ui-avatars.com" },
    { protocol: "https", hostname: "images.unsplash.com" },
    { protocol: "https", hostname: "picsum.photos" },
    { protocol: "https", hostname: "*.supabase.co" },
    { protocol: "https", hostname: "*.r2.dev" },
    { protocol: "https", hostname: "lh3.googleusercontent.com" },
  ]},
  poweredByHeader: false,
  compress: true,
  async headers() { return [{ source: "/:path*", headers: H }]; },
  async redirects() { return [
    { source: "/auth/login", destination: "/login", permanent: true },
    { source: "/auth/register", destination: "/register", permanent: true },
    { source: "/ai-consultants", destination: "/ai-astrologers", permanent: true },
    { source: "/quests", destination: "/sparks", permanent: false },
    { source: "/referral", destination: "/sparks", permanent: false },
    { source: "/bazaar", destination: "/explore", permanent: false },
  ]; },
  turbopack: { root: __dirname },
};
