import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  // Make native modules external to prevent bundling errors
  serverExternalPackages: ['ssh2'],
  output: 'standalone',
  outputFileTracingRoot: projectRoot,
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
