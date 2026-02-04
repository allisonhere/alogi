import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Make native modules external to prevent bundling errors
  serverExternalPackages: ['ssh2'],
  output: 'standalone',
  outputFileTracingExcludes: {
    '*': [
      'packaging/**',
      'dist/**',
      'dist-electron/**',
      'docs/**',
      '.git/**',
      '**/node_modules/.cache/**',
    ],
  },
};

export default nextConfig;
