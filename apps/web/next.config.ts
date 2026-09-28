import type { NextConfig } from "next";

const apiInternalUrl = (
  process.env.API_INTERNAL_URL ?? "http://localhost:4000"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
