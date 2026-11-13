import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off: every page here is per-user and session-dependent,
  // so plain dynamic rendering is simpler and gives real HTTP redirects for auth.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
