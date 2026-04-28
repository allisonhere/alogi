# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.55] - 2026-04-28

### Added
- Internal maintenance and release prep

### Changed
- ci: bump Pages workflow actions to Node 24 versions

### Fixed
- Internal maintenance and release prep

## [0.1.54] - 2026-04-26

### Added
- Internal maintenance and release prep

### Changed
- Internal maintenance and release prep

### Fixed
- Internal maintenance and release prep

## [0.1.53] - 2026-04-26

### Added
- Internal maintenance and release prep

### Changed
- Internal maintenance and release prep

### Fixed
- Massive bug fixes

## [0.1.52] - 2026-04-11

### Added
- Internal maintenance and release prep

### Changed
- Internal maintenance and release prep

### Fixed
- Internal maintenance and release prep

## [0.1.51] - 2026-04-11

### Added
- Add settings update checker

### Changed
- Draft changelog entries in release script

### Fixed
- Fix desktop menu and log toolbar UI

## [0.1.50] - 2026-04-11

### Added
- Add settings update checker

### Changed
- Draft changelog entries in release script

### Fixed
- Fix desktop menu and log toolbar UI

## [0.1.49] - 2026-04-11

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.48] - 2026-04-11

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.47] - 2026-02-07

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.46] - 2026-02-06

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.45] - 2026-02-06

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.44] - 2026-02-06

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.43] - 2026-02-06

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.42] - 2026-02-06

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.41] - 2026-02-06

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.40] - 2026-02-06

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.39] - 2026-02-05

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.38] - 2026-02-05

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.37] - 2026-02-05

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.36] - 2026-02-05

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.35] - 2026-02-05

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.34] - 2026-02-05

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.33] - 2026-02-05

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.32] - 2026-02-04

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.31] - 2026-02-04

### Fixed
- **Critical Build Fix:** Production builds now include missing Turbopack runtime files that caused 500 errors on API routes (including settings page failing to load).
- **Deb Package Fix:** chrome-sandbox now gets correct permissions (root:root, 4755) automatically during install.
- Improved error handling in settings API route.

## [0.1.30] - 2026-02-04

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.29] - 2026-02-04

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

## [0.1.28] - 2026-02-04

### Added
- **Context Menus:** Custom right-click menus throughout the app, replacing browser defaults:
  - **Log Lines:** Copy, Copy with context (±5 lines), Bookmark, Filter to this, Search similar
  - **Hosts Panel:** Copy hostname, Refresh files, Test connection (SSH), Edit host, Remove host
  - **Files Panel:** Copy filename, Copy full path, Refresh, Show info, Open in file manager (local), Copy SCP command (remote)
- **Status Bar:** Bottom bar showing line count, file size, encoding, tail position, and connection status (SSH/Journal/Local).
- **Custom Dialogs:** Styled modal dialogs with variants (success/error/warning/info) replacing all browser `alert()` and `confirm()` calls.
- **.deb Wrapper Script:** Debian package now includes after-install script that creates a wrapper to launch detached from terminal (matching AUR behavior).

### Changed
- Improved clipboard handling with fallback for Electron/non-secure contexts.

## [0.1.27] - 2026-02-03

### Added
- **Unified Remote Host View:** Remote SSH hosts now automatically probe all available log sources (Journal services, /var/log files, Docker containers) in parallel.
- **Collapsible Log Categories:** File list shows categorized sections with collapsible headers - Journal Services (blue), /var/log Files (amber), Docker Containers (purple).
- **Host Icons:** Different icons for local directories, system journal, and remote servers in the host list.
- **Cleaner Host Names:** Remote hosts display without the `remote:` prefix for cleaner UI.

### Changed
- **PKGBUILD Wrapper:** AUR package now uses a wrapper script to launch detached from terminal (no more shell output clutter).

## [0.1.26] - 2026-02-03

### Added
- **Toast Notifications:** Replaced all browser `alert()` dialogs with modern toast notifications for save, connection tests, and other feedback.
- **Unsaved Changes Warning:** Settings page now tracks dirty state, shows an "Unsaved changes" badge, and warns before navigating away.
- **Host Port Configuration:** Added port field to SSH host settings (no longer hardcoded to 22).
- **Duplicate Host Button:** Quickly clone host configurations with one click.
- **Inline Validation:** Real-time validation errors shown as you type, with visual indicators on invalid fields and host cards.
- **Model Categories:** AI model dropdowns now use grouped options (Recommended/Premium/Fast) for easier selection.

### Changed
- **Host Accordion UI:** Configured hosts now collapse to a compact summary row (alias, hostname:port, status dot). Click to expand for editing. New hosts auto-expand.
- **Cleaner AI Settings:** Unified API key input that adapts to selected provider, with clear key button.
- **Advanced Section:** Moved Local Log Directory to a collapsible "Advanced" section at the bottom.

### Removed
- Removed unused "Host Type" dropdown from host configuration.

## [0.1.25] - 2026-02-02

### Added
- **Sudo Elevation:** In-app sudo password prompt when local files or journalctl fail with permission errors. Password cached in memory for the session only.
- **Landing Page v2:** Redesigned project landing page with new layout, sticky nav, and full-width screenshot.

### Fixed
- SSH commands with non-zero exit codes no longer silently resolve — they properly reject with the stderr message.

## [0.1.24] - 2026-02-01

### Added
- **Time Navigation:** Filter log lines by time range with a clock toolbar button. Supports ISO 8601, syslog, bracket-wrapped, and common log format timestamps. Auto-detects and displays the log's time range as a hint. Lines without timestamps pass through (preserving stack traces and continuation lines).

## [0.1.22] - 2026-02-01

### Added
- **Smart AI Context:** Improved AI analysis for large log files. The system now intelligently scans for errors, exceptions, and critical failures, extracting context windows around them (and the tail of the log) instead of just truncating the file. This improves root cause analysis for long-running processes.

## [0.1.21] - 2026-02-01

### Added
- **Regex Search:** Added support for regular expression filtering in the log viewer. Toggle with the `.*` button or `Ctrl+R`.
- **Testing:** Added Vitest unit testing infrastructure.
- **Architecture:** Refactored `LogViewer` into smaller components (`LogLine`) and custom hooks (`useLogScroller`) for better maintainability.

### Changed
- Improved log parsing performance by separating rendering logic from parsing logic.
- Updated documentation with testing instructions and feature details.

## [0.1.20] - 2026-02-01

### Changed
- Bumped version for release.
