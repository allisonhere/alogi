# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start Next.js dev server (http://localhost:3000)
- `npm run dev:desktop` — Start dev server + Electron window
- `npm run build` — Production build (Next.js standalone output)
- `npm run lint` — ESLint
- `npx vitest` — Run all tests
- `npx vitest src/lib/__tests__/logParser.test.ts` — Run a single test file
- `npm run dist:linux` — Build desktop packages (.deb)

## Architecture

Alogi is an AI-powered log viewer built as a Next.js 16 app with an optional Electron wrapper for desktop use. It views logs from four sources: local files, remote SSH servers, systemd journal, and Docker containers.

### Data flow

UI components → Next.js API routes → backend logic (fs/ssh2/execSync/AI SDKs) → data sources

**Dashboard.tsx** is the main orchestrator — it holds all top-level state (selected host, file, live mode, panel widths) and renders the three-panel layout (HostList | FileList | LogViewer). Panel resizing uses refs (not state) to avoid re-renders during drag.

### API routes (`src/app/api/`)

All data fetching goes through Next.js API routes. The key abstraction: `/api/hosts`, `/api/files?host=`, and `/api/content?host=&file=` unify local, SSH, journal, and Docker sources behind a host-prefix convention (`(system-journal)`, `remote:<alias>`, `docker:<alias>`, or plain directory name).

- `/api/analyze` — AI log analysis with **smart truncation**: scans for ERROR/CRITICAL/FATAL keywords, extracts ±5-line context windows, merges overlaps, includes head+tail, caps at 25KB
- `/api/chat` — Conversational AI follow-ups with retry logic for rate limits

### Key libraries (`src/lib/`)

- **logParser.ts** — Tokenizes log lines for syntax highlighting and severity detection (error/warn/info). Handles JSON pretty-printing and search match highlighting.
- **ssh.ts** — Promise-based SSH execution wrapper using ssh2. Supports key-based and password auth.
- **config.ts** — Manages `~/.config/alogi/config.json`. Config merges nested structures; env vars (`LOG_ROOT_DIR`, `GEMINI_API_KEY`, `OPENAI_API_KEY`) override file settings.

### Virtual scrolling

LogViewer uses `useLogScroller` hook for virtualized rendering with a 12-line overscan buffer. Files over 5000 lines are windowed to the last 5000 (unless searching). Wrapping mode disables virtualization.

### Path alias

`@/*` maps to `./src/*` (configured in both tsconfig.json and vitest.config.mts).

### AI providers

Gemini (`@google/generative-ai`) and OpenAI are both supported. Provider is configured in settings; APIs are lazily initialized only when analyze/chat is triggered.

### Sudo elevation (`src/lib/sudo.ts`)

When local file reads or journalctl fail with EACCES, the API routes return 403 with `{ error: 'permission_denied' }`. Dashboard.tsx shows a password modal, POSTs to `/api/sudo` to validate and cache the password in server memory, then retries the failed request. Password is session-only (lost on server restart).

### Landing page (`docs/`)

GitHub Pages site served from `docs/` on `main`. `index.html` is the current live page (v2 design, self-contained with inline CSS). `v2.html` is a copy. `styles.css` is used by the old v1 design only.

## Release process

Use `./scripts/release.sh` for an interactive release workflow, or manually:

1. Update `version` in `package.json`
2. Add entry to `CHANGELOG.md`
3. Run `npm run build` (includes `patch-standalone.sh` to fix Turbopack runtime)
4. Run `npm run dist:linux` to build .deb
5. Build Arch: `tar -C dist-electron -czf packaging/arch/linux-unpacked.tar.gz linux-unpacked && cd packaging/arch && makepkg -f`
6. Commit, push, tag: `git tag v<version> && git push origin v<version>`
7. `gh release create v<version>` and upload assets
8. Update AUR: `cd ~/aur-alogi`, update sha256sums in PKGBUILD, `makepkg --printsrcinfo > .SRCINFO`, commit, push
