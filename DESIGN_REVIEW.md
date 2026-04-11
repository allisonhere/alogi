# Alogi Design Review

**Date:** 2026-04-11
**Reviewer:** Claude (automated)
**Scope:** UI/UX, accessibility, component architecture, visual consistency

---

## Overall Impression

Alogi has a **strong, cohesive design foundation**. The zinc + indigo color system, Geist font pairing, and consistent component patterns show thoughtful design work. This is well above average for a developer tool.

---

## What's Working Well

### Color System
- Zinc neutrals with indigo accents — professional and restrained
- Color-coded host types provide excellent scanability:
  - Blue → System Journal
  - Emerald → Remote/SSH
  - Amber → Local filesystem
  - Purple → Docker containers
- Indigo accents are distinct enough from severity colors (red/amber/blue) that UI chrome never competes with log data

### Theme Support
- Dark-first (`defaultTheme="dark"`) with full light mode via `next-themes`
- Consistent `dark:` variant coverage across all components
- `disableTransitionOnChange` prevents the flash-of-wrong-theme on toggle

### Typography
- **Geist Sans** for UI, **Geist Mono** for log content — an excellent pairing
- Adjustable font size in LogViewer (with increment/decrement controls)

### Component Library
- Custom **Dialog** with 4 variants (success, error, warning, info), each with distinct icon and color
- **Toast** notification system with slide-in animation and auto-dismiss
- **ContextMenu** with icon support, separators, and danger styling
- **OnboardingOverlay** with spotlight highlighting and step-by-step walkthrough
- **VibeCheckBar** — a minimap-style severity heatmap across the log file (creative and useful)

### Panel Layout
- Three-panel design (Hosts | Files | LogViewer) with draggable resize handles
- Color-coded drag handles (indigo for hosts, emerald for files) — subtle but helpful
- Panels can be independently toggled via segmented button group
- Resize uses refs (not state) to avoid re-renders during drag — good performance choice

### Interaction Details
- Right-click context menus on hosts and files with relevant actions
- Keyboard shortcut for file navigation (arrow keys)
- Live-tail mode with auto-scroll-to-bottom
- Virtual scrolling for large files (5000+ lines)

---

## Issues

### Critical — UX Blockers

#### 1. Virtually No Accessibility

**Impact:** Users relying on screen readers or keyboard-only navigation cannot use the app.

| Element | Problem |
|---------|---------|
| Modals (sudo, onboarding) | No focus trap — keyboard focus escapes behind overlay |
| All interactive lists | No `role="listbox"` / `role="option"` semantics |
| Panel toggle buttons | No `aria-pressed` state |
| Context menus | Mouse-only — no keyboard trigger or navigation |
| Search input | The *only* element with an `aria-label` in the entire app |
| Log lines | No `role="log"` or `aria-live` region for live-tail |

**Evidence:** `grep -rn 'aria-' src/components/` returns exactly 1 result (`LogViewer.tsx:861`).

#### 2. No Mobile / Responsive Layout

The three-panel layout has **zero responsive breakpoints** for structural changes. The only responsive CSS is `hidden sm:inline` on a few button labels.

On a narrow viewport (mobile, small Electron window), all three panels render side-by-side in ~360px — **unusable**.

**Affected files:**
- `src/components/Dashboard.tsx` — hardcoded side-by-side flex layout
- `src/components/LogViewer.tsx` — toolbar wrapping relies on `flex-wrap` but panels don't collapse

---

### Major — Polish Issues

#### 3. Empty States Are Bare-Minimum

| State | Current | Ideal |
|-------|---------|-------|
| No file selected | `"Select a file to view logs."` (plain text) | Icon + hint + keyboard shortcut reference |
| Loading content | `"Loading content..."` (plain text) | Skeleton loader or shimmer |
| No hosts configured | Not handled | Setup wizard or link to settings |
| AI not configured | Error shown only on click | Subtle badge or indicator |

Empty states are the most common thing new users see. They're a missed onboarding opportunity.

#### 4. LogViewer.tsx Is 55KB (~1,500 Lines)

This single component contains:
- Toolbar (panel toggles, search, filters)
- Time filter dropdown
- Severity filter
- Font size controls
- Wrap toggle
- AI analysis trigger + results
- Bookmark system
- Insights panel integration
- Chat panel integration
- Virtual scroll log rendering
- VibeCheckBar integration

**Impact:** Hard to test in isolation, prone to visual drift, intimidating to modify.

**Recommendation:** Extract into `LogToolbar`, `LogFilterBar`, `LogContent`, and keep `LogViewer` as an orchestrator.

#### 5. Repeated Inline Styles for Modal Surfaces

The same shadow/border/blur treatment is duplicated across components:

```
// Dashboard.tsx (sudo modal)
shadow-[0_18px_50px_rgba(15,23,42,0.35)]

// OnboardingOverlay.tsx
shadow-[0_18px_50px_rgba(15,23,42,0.35),0_0_30px_rgba(99,102,241,0.25)]
```

No shared `ModalSurface` or utility class exists. These will drift.

---

### Minor — Fit & Finish

#### 6. No Loading Skeletons

File list and content areas show empty space during loading. Skeleton/shimmer states would feel significantly more responsive.

#### 7. Transition Inconsistency

- Buttons and background colors use `transition-colors` consistently
- Panel show/hide is instant (no width animation or collapse effect)
- Onboarding overlay has no enter/exit animation beyond the spotlight

#### 8. No React Error Boundaries

If a component throws (e.g., a malformed log line crashes the parser), the entire app unmounts. A `<ErrorBoundary>` around `LogViewer` would let the sidebar remain functional and show a recovery option.

#### 9. Favicon Configuration

`icon`, `shortcut`, and `apple` in layout metadata all point to the same `logo.svg`. Apple touch icons should be a 180x180 PNG for proper rendering on iOS home screens.

#### 10. No Focus-Visible Styling

Interactive elements don't have visible `:focus-visible` rings beyond browser defaults. For a keyboard-heavy power-user tool, custom focus indicators matching the indigo accent would improve usability.

---

## Recommendations

| Priority | Item | Effort | Files |
|----------|------|--------|-------|
| **P0** | Add keyboard focus trap to modals | S | `Dashboard.tsx`, `OnboardingOverlay.tsx` |
| **P0** | Add `aria-label`, `role`, `aria-pressed` to interactive elements | S | All components |
| **P1** | Extract LogViewer into sub-components | M | `LogViewer.tsx` → new files |
| **P1** | Create shared `ModalSurface` component | S | New component, update modals |
| **P1** | Design meaningful empty states | S | `LogViewer.tsx`, `FileList.tsx` |
| **P2** | Add skeleton loaders | S | `FileList.tsx`, `LogViewer.tsx` |
| **P2** | Add panel collapse/expand animation | S | `Dashboard.tsx` |
| **P2** | Add React error boundary | S | New `ErrorBoundary.tsx` |
| **P2** | Add `:focus-visible` ring styles | S | `globals.css` |
| **P3** | Responsive layout for narrow viewports | M | `Dashboard.tsx` |
| **P3** | Generate proper apple-touch-icon | Trivial | `public/`, `layout.tsx` |

**Effort key:** S = Small (< 1 hour), M = Medium (1–4 hours), L = Large (4+ hours)

---

## Component Size Audit

| Component | Size | Lines (approx) | Status |
|-----------|------|-----------------|--------|
| `LogViewer.tsx` | 54.9 KB | ~1,500 | Needs decomposition |
| `Dashboard.tsx` | 22.4 KB | ~600 | Acceptable but large |
| `ChatPanel.tsx` | 18.1 KB | ~500 | Acceptable |
| `FileList.tsx` | 11.5 KB | ~330 | Good |
| `HostList.tsx` | 9.8 KB | ~280 | Good |
| `Dialog.tsx` | 6.1 KB | ~170 | Good |
| `LogLine.tsx` | 5.9 KB | ~170 | Good |
| `OnboardingOverlay.tsx` | 5.2 KB | ~150 | Good |
| `InsightsPanel.tsx` | 5.0 KB | ~140 | Good |
| `VibeCheckBar.tsx` | 4.3 KB | ~120 | Good |
| `ContextMenu.tsx` | 3.0 KB | ~85 | Good |
| `Toast.tsx` | 2.5 KB | ~70 | Good |

---

## Tech Stack Summary

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 16.1.6 | App Router, standalone output |
| Styling | Tailwind CSS v4 | No component library (shadcn, etc.) |
| Icons | lucide-react | Consistent 3.5x3.5 sizing |
| Theme | next-themes | Dark default, system support |
| Typography | Geist Sans + Geist Mono | Via `next/font/google` |
| Utilities | clsx + tailwind-merge | Via `cn()` helper |
| Desktop | Electron 32 | Optional wrapper |
