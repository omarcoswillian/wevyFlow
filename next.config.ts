import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Allow larger request bodies for page import (Figma pages with inline images)
  serverExternalPackages: [],
};

export default nextConfig;
