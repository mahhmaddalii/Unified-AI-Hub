// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  allowedDevOrigins: [
    'http://127.0.0.1:3000',
    'http://localhost:3000',
  ],
};

module.exports = withBundleAnalyzer(nextConfig);