import type { NextConfig } from "next";

const rawAppUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || '';
const appUrl = rawAppUrl.replace(/^https?:\/\//, '');

const allowedOrigins = ['localhost:3000'];
if (appUrl) allowedOrigins.push(appUrl);

const nextConfig: NextConfig = {
  transpilePackages: ['lucide-react', '@xenova/transformers'],
  // @ts-ignore
  allowedDevOrigins: appUrl ? [appUrl] : [],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      allowedOrigins: allowedOrigins,
    },
  }
};

export default nextConfig;
