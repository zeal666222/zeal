/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@zeal/ui', '@zeal/types'],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "ui-avatars.com" }, { protocol: "https", hostname: "images.unsplash.com" }, { protocol: "https", hostname: "picsum.photos" }],
  },
};

module.exports = nextConfig;
