import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root; a lockfile in a parent dir otherwise confuses
  // Next's auto-detection.
  turbopack: { root: __dirname },

  // The 34 MB parking dataset is read at runtime via
  // `path.join(process.cwd(), "data", "parking.geojson")`. That dynamic path is
  // invisible to @vercel/nft's static trace, so without this it would be missing
  // from the serverless bundle (ENOENT in production). Force-include it for the
  // two routes that call loadDataset().
  outputFileTracingIncludes: {
    "/api/parking": ["./data/parking.geojson"],
    "/api/nearest": ["./data/parking.geojson"],
  },
};

export default nextConfig;
