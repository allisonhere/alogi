# Fix Alogi Slow Startup

  ## Summary

  Fix the actual startup path by correcting Next’s project root/build output, then prevent restored remote log sessions from blocking
  first paint.

  ## Key Changes

  - Add explicit Next root/tracing configuration in next.config.ts:3 so Next always treats /home/allie/Projects/alogi as the app root
    despite parent lockfiles.

  Short version: the “fix” didn’t hit the real blocker. I found two separate problems.

  The main load failure is Next resolving the project from /home/allie/Projects, not /home/allie/Projects/alogi, because there are parent
  lockfiles. Dev server then spams Can't resolve 'tailwindcss' in '/home/allie/Projects', and / never completed in my timing test. That
  points at missing turbopack.root / tracing root config in next.config.ts:3.

  Separately, the dashboard restores the last selected remote host/file from localStorage on startup, then immediately calls /api/files
  and /api/content in src/components/Dashboard.tsx:98. Remote calls can wait up to 30s in src/lib/ssh.ts:23, and the files endpoint runs
  three SSH probes in src/app/api/files/route.ts:129. So if a host is slow/down, startup can look like it is “loading” for roughly a
  minute.
  - Update the standalone patch script to patch the nested `.next/standalone/Projects/alogi/...Fix Alogi Startup Load Time

  Summary

  - Fix the project-root mismatch first; it is currently breaking page compilation and standalone output.
  - Then make restored remote sessions non-blocking so the app shell renders immediately even if SSH is slow.

  Key Changes

  - Add explicit Next root configuration in next.config.ts:
      - Set turbopack.root to the repo directory.
      - Set outputFileTracingRoot to the repo directory.
  - Rebuild after dependencies match the lockfile, because package.json/package-lock.json declare Next 16.2.4 but installed node_modul
    es/next is 16.1.6.
  - Update the standalone patch script so it patches the actual nested standalone path and also copies missing next/dist/server/lib/
    cpu-profile.*.
  - Change dashboard restore behavior:
      - Restore host/file selection visually, but render the shell immediately.
      - Do not block initial UI on /api/files or /api/content.
      - Remove selectedFile from the files-fetch effect dependency so selecting/restoring a file does not refetch the file list
        unnecessarily.
  - Add shorter, explicit SSH probe behavior for startup paths:
      - Use a lower timeout for discovery probes than for reading content.
      - Surface connection/probe errors in the UI instead of leaving indefinite loading states.

  Test Plan

  - Run npm install or equivalent lockfile sync, then verify node_modules/next is 16.2.4.
  - Run npm run dev; confirm no workspace-root warning and no Tailwind resolution errors.
  - Time /, /api/hosts, /api/files?host=remote:jarvis, and /api/content?...; / should return promptly.
  - Run npm run build; start .next/standalone/Projects/alogi/server.js directly and confirm it no longer fails on cpu-profile.
  - Test startup with:
      - no restored session,
      - restored local/system journal,
      - restored remote host online,
      - restored remote host offline.

  Assumptions

  - The desired behavior is for the app shell to appear immediately, with remote logs loading asynchronously.
  - Remote SSH failures should not block app startup.
  - Parent /home/allie and /home/allie/Projects lockfiles should not control this app’s Next project root.