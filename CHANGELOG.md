# Changelog

All notable changes to **Tab Zen** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-04-25

Initial public release submitted to the Chrome Web Store.

### Added

- **Auto-close inactive tabs** — Tabs are closed automatically once they exceed the configured idle threshold. Threshold is configurable in minutes / hours / days (up to 30 days).
- **Two-stage suspend → close** — Tabs are first discarded with `chrome.tabs.discard()` to free memory while keeping the UI; after a longer threshold they are fully closed.
- **Arc-style MRU tab switcher (Ctrl+Q)** — Centered overlay with thumbnails. Hold Ctrl and tap Q to step through, release Ctrl to confirm. `Ctrl+Shift+Q` reverses direction.
- **Restore history** — Auto-closed tabs can be reopened with one click. Persists across browser restarts (default 100 entries, configurable).
- **Smart exclusions** — Pinned tabs, audible tabs, the active tab, tabs with unsaved form input, and any domain on the user's allowlist are automatically excluded.
- **Duplicate detection** — Normalizes URLs (UTM stripping, trailing slash, fragments) to find duplicate tabs and closes all but the most recent.
- **Keyboard shortcuts**:
  - `Ctrl+Q` / `Ctrl+Shift+Q` — MRU switcher (next / prev)
  - `Alt+Shift+X` — Close all tabs that exceed the close threshold right now
  - `Alt+Shift+D` — Detect and close duplicate tabs (with confirmation)
- **Confirmations on destructive actions** — Bulk close and duplicate close show a count and a confirmation dialog.
- **Options page** — General settings, allowlist with wildcard support (`*.notion.so`), shortcut overview, restore-history search, thumbnail cache management.
- **Popup** — Tab stats, quick actions (close inactive / close duplicates / suspend all), recent restore-history (5 entries).
- **Privacy** — All data is stored locally in `chrome.storage`. No network requests are made and no personal data is collected.

[Unreleased]: https://github.com/minisera/tabzen/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/minisera/tabzen/releases/tag/v1.0.0
