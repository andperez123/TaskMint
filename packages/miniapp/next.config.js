/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Resolve monorepo packages
  transpilePackages: [],
  // Suppress WalletConnect pino-pretty warnings
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
    };
    return config;
  },
};

module.exports = nextConfig;
