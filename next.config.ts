import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Inject waktu build (ISO string) agar bisa dibaca di client-side melalui process.env.NEXT_PUBLIC_BUILD_TIME
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    // Expose Vercel git SHA sebagai NEXT_PUBLIC agar bisa dibaca di client
    // Vercel otomatis menyediakan VERCEL_GIT_COMMIT_SHA; kita forwardkan sebagai NEXT_PUBLIC
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || '',
  }
};

export default nextConfig;
