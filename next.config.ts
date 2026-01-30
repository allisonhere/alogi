import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Make native modules external to prevent bundling errors
  serverExternalPackages: ['ssh2'],
};

export default nextConfig;
