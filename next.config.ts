import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the project root so Turbopack ignores sibling lockfiles.
    root: __dirname,
  },
};

export default nextConfig;
