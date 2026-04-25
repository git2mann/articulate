import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['lucide-react', '@xenova/transformers'],
  // @ts-ignore
  allowedDevOrigins: ['5deb-193-40-56-36.ngrok-free.app'],
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
      allowedOrigins: ['5deb-193-40-56-36.ngrok-free.app', 'localhost:3000'],
    },
  }
};

export default nextConfig;
