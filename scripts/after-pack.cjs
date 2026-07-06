/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

// electron-builder >= 25 filters node_modules out of extraResources copies,
// but the Next.js standalone server needs its traced node_modules at runtime.
module.exports = async (context) => {
  const src = path.join(context.packager.projectDir, '.next', 'standalone', 'node_modules');
  const dest = path.join(context.appOutDir, 'resources', '.next', 'standalone', 'node_modules');

  if (!fs.existsSync(src)) {
    throw new Error(`Standalone node_modules not found at ${src}. Run "npm run build" first.`);
  }

  console.log('  • copying Next.js standalone node_modules into resources');
  fs.cpSync(src, dest, { recursive: true, dereference: true });
};
