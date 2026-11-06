/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  serverExternalPackages: ['@distube/ytdl-core'],
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
