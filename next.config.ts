import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
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
