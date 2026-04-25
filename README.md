# Tab Zen

[日本語版 →](./README.ja.md)

A Chrome extension that quietly tidies up your tab clutter over time and provides an Arc-style most-recently-used (MRU) tab switcher.

---

## What it does

- **Auto-close inactive tabs** — Tabs are closed automatically once they exceed your configured idle threshold. Set the threshold in **minutes / hours / days** (up to 30 days).
- **Two-stage suspend → close** — Tabs are first discarded with `chrome.tabs.discard()` to free memory while keeping the UI; after a longer threshold they are fully closed.
- **Switch to recent tabs with Ctrl+Q** — A centered overlay with thumbnails appears; hold Ctrl and tap Q repeatedly to step through, release Ctrl to confirm.
- **Restore history** — Auto-closed tabs can be reopened with one click. Persists across browser restarts (default 100 entries, configurable).
- **Smart exclusions** — Pinned tabs, audible tabs, the active tab, tabs with unsaved form input, and any domain on your allowlist are automatically excluded.
- **Duplicate detection** — Normalizes URLs (UTM stripping, trailing slash, fragments) to find duplicate tabs and closes all but the most recent.
- **Confirmations on destructive actions** — Bulk close and duplicate close show a count and a confirmation dialog.

---

## Install

### Chrome Web Store

(coming soon)

### Load unpacked (developer mode)

1. Download `tabzen-vX.Y.Z.zip` from the [Releases](https://github.com/minisera/tabzen/releases) page and extract it
2. Open `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the extracted folder
5. Pin Tab Zen from the puzzle-piece menu so it stays on the toolbar

---

## How to use

### Keyboard shortcuts

| Shortcut         | Action                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------- |
| **Ctrl+Q**       | Open the MRU switcher overlay. Hold Ctrl and tap Q to move down; release Ctrl to confirm. |
| **Ctrl+Shift+Q** | Move up (reverse direction) in the overlay.                                               |
| **Alt+Shift+X**  | Close all tabs that exceed the close threshold right now.                                 |
| **Alt+Shift+D**  | Detect and close duplicate tabs (with confirmation).                                      |
| `Esc`            | Cancel the overlay (no tab switch).                                                       |
| `Enter` / click  | Switch to the highlighted tab.                                                            |
| `↑` `↓` `←` `→`  | Move the selection in the overlay (alternative to Q).                                     |

> Ctrl+Tab is reserved by Chrome for built-in browser navigation and cannot be intercepted by extensions, so Tab Zen uses **Ctrl+Q** by default. You can rebind any shortcut from `chrome://extensions/shortcuts`.

### Popup (toolbar icon)

- **Stats**: total tabs / close candidates / suspended count
- **Quick actions**: close threshold-exceeding tabs, close duplicates, suspend all
- **Recently closed (5)**: click to restore as a new tab

### Options page

Right-click the toolbar icon → **Options** to configure:

- **General**: enable/disable auto-processing, suspend / close thresholds (minutes / hours / days), restore-history limit, MRU overlay size (2–10), thumbnail cache management
- **Allowlist**: domains excluded from auto-management (e.g. `github.com`, `*.notion.so` with wildcard support)
- **Shortcuts**: current key bindings + a link to `chrome://extensions/shortcuts`
- **History**: search, restore individually, or clear all closed-tab history

---

## Privacy

Tab Zen **does not collect or transmit any personal data**. All data lives in your browser's `chrome.storage` and no network requests are made. See [PRIVACY.md](./PRIVACY.md) for details.

---

## Development

```bash
pnpm install
pnpm dev      # Vite dev server (live-outputs to dist/)
pnpm build    # production build
pnpm test     # Vitest
pnpm lint     # ESLint
```

Stack: Vite 6 + React 19 + TypeScript (strict) + Tailwind CSS v4 + Zustand + Zod + Vitest. Manifest V3.

---

## License

[MIT License](./LICENSE) © 2025 minisera
