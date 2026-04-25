# Tab Zen — Privacy Policy

[日本語版 →](./PRIVACY.ja.md)

Last updated: 2026-04-25

## Summary

**Tab Zen does not collect or transmit any personal data.** All data is stored locally in your browser's `chrome.storage` and is never sent to any external server. Tab Zen makes no network requests on its own.

## What data the extension handles

| Data                                                                                                           | Stored in              | Purpose                                              | Retention                                                      |
| -------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| Open tab metadata (URL / title / favicon / last active timestamp / pinned & audible state / unsaved-form flag) | `chrome.storage.local` | Auto-close decisions, MRU switching, restore history | Until the tab is closed                                        |
| User settings (thresholds, allowlist, overlay size, etc.)                                                      | `chrome.storage.sync`  | Persist settings and sync via your Google account    | Until removed by the user                                      |
| Tab thumbnails (low-resolution JPEG, max 100)                                                                  | `chrome.storage.local` | Preview images for the Alt+Q overlay                 | Removed after 7 days, when the tab closes, or via manual clear |
| Auto-closed tab history (URL / title / closed-at)                                                              | `chrome.storage.local` | One-click restoration                                | Default 100 entries (user-configurable)                        |

`chrome.storage.sync` is Google's standard sync mechanism. Tab Zen itself does not initiate any independent network communication.

## Why each permission is required

| Permission                     | Purpose                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `tabs`                         | Read open tab metadata to manage auto-cleanup and MRU history                                                                  |
| `alarms`                       | Run the 1-minute scan that checks idle thresholds and processes tabs                                                           |
| `storage`                      | Persist settings, history, and thumbnails locally                                                                              |
| `scripting`                    | Re-inject the content script into already-open tabs after the extension is updated, so the Alt+Q overlay works immediately     |
| `host_permissions: <all_urls>` | Display the Alt+Q overlay on every web page and detect unsaved form input. The extension does not read or modify page content. |

## Sharing with third parties

None. Tab Zen does not share data with anyone.

## How to delete your data

- **Settings & history**: removing Tab Zen from `chrome://extensions/` deletes all associated data
- **Thumbnail cache**: clear from Options → General → Thumbnail Cache → Clear
- **Restore history**: delete individually or all at once from Options → History

## Contact

GitHub Issues: https://github.com/minisera/tabzen/issues
