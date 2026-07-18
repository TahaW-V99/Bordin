import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  env: {
    NEXT_PUBLIC_BORDIN_ENV: process.env.BORDIN_ENV ?? "",
    NEXT_PUBLIC_STORE_SELL_ENABLED: process.env.STORE_SELL_ENABLED ?? "",
  },
  async rewrites() {
    return [
      {
        source: "/uploads/team-competition-banners/:filename",
        destination: "/api/team-competition-banners/:filename",
      },
    ];
  },
};

export default nextConfig;
