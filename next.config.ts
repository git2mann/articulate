import type { NextConfig } from "next";

const rawAppUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || '';
const appUrl = rawAppUrl.replace(/^https?:\/\//, '');

const allowedOrigins = ['localhost:3000'];
if (appUrl) allowedOrigins.push(appUrl);

const nextConfig: NextConfig = {
  transpilePackages: ['lucide-react', '@huggingface/transformers'],
  allowedDevOrigins: appUrl ? [appUrl, 'c5e6-193-40-56-36.ngrok-free.app'] : ['c5e6-193-40-56-36.ngrok-free.app'],
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
      allowedOrigins: [...allowedOrigins, 'c5e6-193-40-56-36.ngrok-free.app'],
    },
  }
};

export default nextConfig;
