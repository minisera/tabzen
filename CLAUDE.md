# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tab Zen is a Chrome extension (Manifest V3) that auto-suspends/closes idle tabs and provides an Arc-style MRU tab switcher. Built with Vite 6 + React 19 + TypeScript (strict) + Tailwind v4 + Zustand + Zod, bundled via `@crxjs/vite-plugin`. Package manager is **pnpm** (`packageManager` is pinned).

## Commands

```bash
pnpm install            # install (note: minimum-release-age=4320min in .npmrc; new releases are blocked for 3 days)
pnpm dev                # Vite dev server with HMR; live-rebuilds dist/ for unpacked load
pnpm build              # tsc -b && vite build → dist/ (load-unpacked target)
pnpm typecheck          # tsc -b only
pnpm lint               # eslint .
pnpm lint:fix
pnpm test               # vitest run
pnpm test:watch
pnpm test:coverage
pnpm format             # prettier --write
```

Run a single test file: `pnpm vitest run tests/unit/mru-stack.test.ts`. Husky + lint-staged run ESLint + Prettier on commit.

After `pnpm build`, load unpacked from `chrome://extensions/` pointing at `dist/`. The `crx` plugin emits a working MV3 bundle including the manifest from `src/manifest.ts`.

## Architecture

The extension has **three runtime contexts** that communicate only via `chrome.runtime` messages — never import across them.

1. **Service Worker** (`src/background/`) — single source of truth for tab state, scheduling, and storage writes.
2. **Content Script** (`src/content/`) — injected at `document_start` into every page; renders the MRU switcher overlay and search palette inside a Shadow DOM.
3. **UI surfaces** (`src/popup/`, `src/options/`) — React apps loaded by the toolbar popup and options page; both call into the SW via `sendMessage`.

Shared code lives in `src/shared/` and is import-safe from any context. Path alias `@/` → `src/`.

### Message protocol (`src/shared/types.ts`)

All cross-context calls go through two discriminated unions:

- `RuntimeRequest` (UI/CS → SW) — handled in `src/background/messaging.ts`. Each `kind` maps to a return type via `RuntimeResponseMap`. Use `sendMessage` from `src/shared/lib/runtime-client.ts` (typed) or `sendMessageVoid` (fire-and-forget; swallows "Extension context invalidated" after extension reload).
- `ContentRequest` (SW → CS) — sent via `chrome.tabs.sendMessage`. The CS bridge in `src/content/index.tsx` re-dispatches these as DOM `CustomEvent`s (`tabzen:tab-switch`, `tabzen:open-search-palette`) which React components listen for.

When adding a new SW endpoint: add the `kind` to `RuntimeRequest`, add the response type to `RuntimeResponseMap`, then add the `case` in `messaging.ts`. The exhaustive `default` (`_exhaustive: never`) will surface missing handlers at type-check time.

### Storage layout

- `chrome.storage.sync` — only `settings` (validated by Zod `settingsSchema`; bad data falls back to `defaultSettings` rather than throwing).
- `chrome.storage.local` — `tabMeta` (record keyed by `tabId`), `mruStacks` (per-window `tabId[]`), `restoreHistory`, `thumbnails` (capped at 100, 7-day TTL via `expireOldThumbnails`), `dailyStats` (90-day rolling).

All storage access goes through helpers in `src/shared/storage/`; do not call `chrome.storage` directly from feature code.

### Tab lifecycle

`tab-monitor.ts` listens to `chrome.tabs.onCreated/onUpdated/onActivated/onRemoved/onReplaced` and keeps `tabMeta` + `mruStacks` in sync. `lastActiveAt` is **only** bumped on `onActivated` (not on URL/title updates) — the auto-cleaner reads this to decide what's idle.

`auto-cleaner.ts` runs every minute via `chrome.alarms` (`tabzen-scan`). Two-stage flow: tabs idle past `suspendAfterMinutes` get `chrome.tabs.discard()`'d; tabs past `closeAfterMinutes` get pushed to `restoreHistory` then `chrome.tabs.remove()`'d. `closeAfterMinutes` must be `>` `suspendAfterMinutes` (Zod-enforced).

`exclusionReason()` is the single decision point for "should this tab be touched" — pinned, audible, active-in-its-window, formDirty, or allowlisted (domain match with `*.example.com` wildcard support). Reuse it; don't re-implement the rules.

`recordDailyStat()` is called from auto-cleaner / duplicate-finder after any close/suspend so the Statistics page can render history.

### Ctrl+Q MRU switcher

The non-trivial part: Chrome reserves Ctrl+Tab, so we use `Ctrl+Q` (command `switch-tab-fallback`). When fired, the SW asks the CS to render the overlay. If the CS is unreachable (e.g. `chrome://` page), it falls back to `tickDirectCycle` in `background/index.ts` — a SW-side rotating cursor with a 1.5s timeout that walks the MRU stack one tab at a time. The cycle's `snapshot` is **frozen** at start; subsequent activations don't reshuffle it, otherwise tapping Q twice would oscillate between the same two tabs.

### Content Script injection invariants

`src/content/index.tsx` handles two re-injection cases that both must work:

1. Same-session double injection (manifest auto-injection + `injectContentScriptIntoExistingTabs` from `onInstalled`).
2. Extension reload — the old isolated world's `chrome.runtime` is dead, so the bridge listener must be re-registered or `Ctrl+Q` silently breaks.

Solution: store the previous cleanup fn on `window[CLEANUP_KEY]` and tear-down + re-init on every injection. Don't replace this with a boolean "already initialized" flag — case (2) regresses (tab switcher overlay broke after extension reload, fixed in 1.0.1).

The CS mounts inside a Shadow DOM with `:root` → `:host` substitution applied to the inlined Tailwind CSS, because Tailwind v4's `@theme` variables target `:root` which doesn't match a Shadow Root.

### Settings store

`src/shared/stores/settings-store.ts` is a Zustand store used by the options page. It calls `getSettings`/`setSettings` (which round-trip through `chrome.storage.sync`). The popup does **not** use it — it pulls fresh data via `usePopupData` to stay snappy.

## Conventions

- TypeScript strict; prefer Zod schemas in `src/shared/schema/` as the source of truth — derive TS types via `z.infer`.
- Comments are in Japanese and explain **why** (race conditions, Chrome quirks, security tradeoffs). Don't add comments restating what the code does.
- Tests live in `tests/unit/`, use `happy-dom`, and stub `chrome.*` per-test (see `tests/unit/Popup.test.tsx`). There is no global chrome mock.
- User-facing strings (popup/options) are Japanese; manifest strings are i18n'd via `public/_locales/{en,ja}/messages.json` (`__MSG_*__` placeholders).
- `console.log` with `[Tab Zen]` prefix is acceptable in the SW — it shows up in the service worker DevTools and is the primary debugging surface.

## Release flow

Version lives in `package.json` and is read by `src/manifest.ts` at build time. CHANGELOG.md uses Keep a Changelog format. CodeQL + Dependabot run via `.github/workflows/`. All GitHub Actions are pinned to commit SHAs (with version comment) — preserve this when editing workflows.
