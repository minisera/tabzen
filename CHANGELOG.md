# Changelog

All notable changes to **Tab Zen** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2026-04-25

First public release. The previous 1.0.0 submission was withdrawn before review completed; this release supersedes it with hardening improvements.

### Added

- **Manifest i18n** — `_locales/{en,ja}/messages.json` for the extension name, description, and command descriptions. The Web Store and `chrome://extensions/` now show localized text per the user's Chrome locale.
- **Explicit Content Security Policy** — `script-src 'self'; object-src 'self'` declared in the manifest. Equivalent to MV3 default but explicit, communicating the security stance to users and reviewers.

### Fixed

- **Tab switcher overlay broke after extension reload** — Existing tabs would only switch tabs without showing the centered overlay until the page was reloaded. The double-injection guard left a stale window flag that prevented the bridge listener from re-registering. Now tears down + re-initializes on every injection.

### Security

- **Build supply-chain hardening** — pnpm `minimum-release-age=4320` (3 days) blocks installation of recently-published packages that may be malicious. All GitHub Actions are pinned to commit SHAs (with version comment for Dependabot tracking) to defend against tag tampering. Workflow `permissions:` are minimized to `contents: read` for CI.
- **Static analysis on every PR** — CodeQL workflow added for JavaScript/TypeScript (queries: `security-and-quality`).
- **Resolved GHSA-mw96-cpmx-2vgc** (rollup < 2.80.0 path traversal, HIGH) — `@crxjs/vite-plugin` was bringing in vulnerable rollup 2.79.2 as a transitive dependency. `pnpm.overrides` forces it to rollup 4 (matching what Vite 6 already uses). Build-only impact; no runtime change for users.

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

[Unreleased]: https://github.com/minisera/tabzen/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/minisera/tabzen/releases/tag/v1.0.1
[1.0.0]: https://github.com/minisera/tabzen/releases/tag/v1.0.0
