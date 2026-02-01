# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start Next.js dev server (http://localhost:3000)
- `npm run dev:desktop` — Start dev server + Electron window
- `npm run build` — Production build (Next.js standalone output)
- `npm run lint` — ESLint
- `npx vitest` — Run all tests
- `npx vitest src/lib/__tests__/logParser.test.ts` — Run a single test file
- `npm run dist:linux` — Build desktop packages (AppImage + .deb)

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
