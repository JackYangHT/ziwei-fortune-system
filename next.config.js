/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lunar-javascript'],
  devIndicators: false,
  experimental: {
    agentUpgrade: 'security',
  },
};

module.exports = nextConfig;
