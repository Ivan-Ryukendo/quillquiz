import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/exam/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "script-src 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
