import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root; a lockfile in a parent dir otherwise confuses
  // Next's auto-detection.
  turbopack: { root: __dirname },
};

export default nextConfig;
