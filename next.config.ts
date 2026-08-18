import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Inject waktu build (ISO string) agar bisa dibaca di client-side melalui process.env.NEXT_PUBLIC_BUILD_TIME
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    // Expose Vercel git SHA sebagai NEXT_PUBLIC agar bisa dibaca di client
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || '',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

