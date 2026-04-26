# Changelog

All notable changes to **Tab Zen** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **MRU タブ切替オーバーレイがページによって縮む / 位置ずれする問題** — ページ側 (`<html>` 等) に `transform` / `filter` / `contain` 等が当たっていると、`position: fixed` の containing block が viewport から外れてしまい、オーバーレイが小さく表示される / 位置がずれることがあった (Notion / Linear / 一部 Next.js サイト等)。Content Script のホスト要素を `popover="manual"` + `showPopover()` で **Top Layer** に載せ、ページ側の CSS から完全に独立させて常に viewport 全体にフィットするようにした。`showPopover` 非対応の古い Chrome (<114) は従来通りの動作にフォールバック。
- **MRU 履歴が 1〜2 件しかない時に切替オーバーレイが極端に小さくなる問題** — カードに `min-h-[280px]` を追加し、件数が少なくても一定の高さを保つようにした。併せて狭い viewport で 720px がはみ出さないよう `max-w-[92vw]` も追加 (検索パレットと同じガード)。

### Changed

- **Popup stats labels** — `タブ数` / `クローズ候補` / `サスペンド済` の意味が一目で伝わらないため、各セルにホバー (またはキーボードフォーカス) で説明を表示するツールチップを追加した。
- **Options > Shortcuts** — デフォルトキー未設定のショートカット (`現在のウィンドウの全タブをクローズ` と `MRU タブ切替 (前へ)`) について、コマンド説明文に括弧書きで埋めていた理由を、キー側の `未設定` バッジに付くツールチップへ移動した。本文がすっきりし、未設定の理由 (危険性 / Chrome のキー数上限) もホバーで確認できる。

## [1.0.2] - 2026-04-25

### Fixed

- **Options > About tab** — License field showed the placeholder "未定（リリース前に決定予定）" left over from pre-release. Now correctly displays "MIT License" with a link to the LICENSE file.

### Added

- **Options > About tab** — Repository link and privacy-policy link added so users can quickly find the source and privacy details from inside the extension.

### Internal

- **CodeQL `js/incomplete-url-substring-sanitization` fix** — `thumbnail-capture.ts` now parses URLs with `new URL()` and matches by `hostname`, instead of `startsWith()` which could be bypassed by host-suffix tricks like `https://chromewebstore.google.com.evil.com`. No user-facing impact (the URL source was already trusted), but the check is now correct.
- **Workflow permissions hardening** — `release.yml` and `codeql.yml` use top-level `read-all` and per-job write elevation, satisfying OpenSSF Scorecard's `Token-Permissions` check.
- **`SECURITY.md`** added to declare the private vulnerability-reporting channel and SLA.

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

[Unreleased]: https://github.com/minisera/tabzen/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/minisera/tabzen/releases/tag/v1.0.2
[1.0.1]: https://github.com/minisera/tabzen/releases/tag/v1.0.1
[1.0.0]: https://github.com/minisera/tabzen/releases/tag/v1.0.0
