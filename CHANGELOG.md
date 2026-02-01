# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
