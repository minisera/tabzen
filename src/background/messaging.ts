import type { RuntimeRequest, Stats } from '@/shared/types';
import { getSettings, setSettings } from '@/shared/storage/settings';
import { getTabMeta, setTabMeta } from '@/shared/storage/local-state';
import {
  closeAllInWindow,
  closeInactiveNow,
  exclusionReason,
  getActiveTabIds,
  selectCloseTargets,
  suspendAll,
} from './auto-cleaner';
import { closeDuplicates, findDuplicates } from './duplicate-finder';
import { clearHistory, listHistory, restoreAt } from './restore-history';
import { getMruForWindow } from './mru-stack';
import { clearAllThumbnails, getThumbnails, getThumbnailStats } from '@/shared/storage/thumbnails';
import { clearDailyStats, getDailyStats } from '@/shared/storage/daily-stats';

async function computeStats(): Promise<Stats> {
  const map = await getTabMeta();
  const settings = await getSettings();
  const activeIds = await getActiveTabIds();
  const list = Object.values(map);
  const now = Date.now();
  const managedCount = list.filter(
    (m) => exclusionReason(m, settings, activeIds) === 'none',
  ).length;
  const closeCandidates = selectCloseTargets(list, settings, activeIds, now).length;
  const suspendedCount = list.filter((m) => m.suspended).length;
  return {
    totalTabs: list.length,
    closeCandidates,
    managedCount,
    suspendedCount,
  };
}

export function initMessaging(): void {
  chrome.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const msg = raw as RuntimeRequest;
    (async () => {
      try {
        switch (msg.kind) {
          case 'getSettings':
            sendResponse({ ok: true, data: await getSettings() });
            return;
          case 'setSettings':
            await setSettings(msg.settings);
            sendResponse({ ok: true });
            return;
          case 'getStats':
            sendResponse({ ok: true, data: await computeStats() });
            return;
          case 'closeInactiveNow': {
            const closed = await closeInactiveNow(await getSettings());
            sendResponse({ ok: true, data: { closed } });
            return;
          }
          case 'closeDuplicates': {
            const closed = await closeDuplicates(await getSettings());
            sendResponse({ ok: true, data: { closed } });
            return;
          }
          case 'suspendAll': {
            const suspended = await suspendAll(await getSettings());
            sendResponse({ ok: true, data: { suspended } });
            return;
          }
          case 'closeAllInWindow': {
            const win =
              sender.tab?.windowId ?? (await chrome.windows.getCurrent().catch(() => null))?.id;
            if (typeof win !== 'number') {
              sendResponse({ ok: false, error: 'no current window' });
              return;
            }
            const closed = await closeAllInWindow(win, await getSettings());
            sendResponse({ ok: true, data: { closed } });
            return;
          }
          case 'findDuplicates':
            sendResponse({ ok: true, data: await findDuplicates(await getSettings()) });
            return;
          case 'listHistory':
            sendResponse({ ok: true, data: await listHistory() });
            return;
          case 'restoreAt':
            await restoreAt(msg.index);
            sendResponse({ ok: true });
            return;
          case 'clearHistory':
            await clearHistory();
            sendResponse({ ok: true });
            return;
          case 'getMruPreview': {
            const win =
              msg.windowId ??
              sender.tab?.windowId ??
              (await chrome.windows.getCurrent().catch(() => null))?.id;
            if (typeof win !== 'number') {
              sendResponse({ ok: false, error: 'no window' });
              return;
            }
            const ids = await getMruForWindow(win);
            const map = await getTabMeta();
            const thumbs = await getThumbnails();
            const items = ids
              .map((id) => {
                const meta = map[id];
                if (!meta) return null;
                return { ...meta, thumbnail: thumbs[id]?.dataUrl };
              })
              .filter((v): v is NonNullable<typeof v> => !!v);
            sendResponse({ ok: true, data: items });
            return;
          }
          case 'getAllTabs': {
            const map = await getTabMeta();
            const thumbs = await getThumbnails();
            const items = Object.values(map)
              .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
              .map((meta) => ({ ...meta, thumbnail: thumbs[meta.tabId]?.dataUrl }));
            sendResponse({ ok: true, data: items });
            return;
          }
          case 'switchToTab': {
            const tab = await chrome.tabs.update(msg.tabId, { active: true });
            // クロスウィンドウ切替時はウィンドウもフォーカスする。
            // 同一ウィンドウなら no-op に近い。
            if (typeof tab?.windowId === 'number') {
              try {
                await chrome.windows.update(tab.windowId, { focused: true });
              } catch {
                // window が閉じている等
              }
            }
            sendResponse({ ok: true });
            return;
          }
          case 'getThumbnailStats':
            sendResponse({ ok: true, data: await getThumbnailStats() });
            return;
          case 'clearThumbnails':
            await clearAllThumbnails();
            sendResponse({ ok: true });
            return;
          case 'getDailyStats':
            sendResponse({ ok: true, data: await getDailyStats() });
            return;
          case 'clearDailyStats':
            await clearDailyStats();
            sendResponse({ ok: true });
            return;
          case 'reportFormDirty': {
            const tid = sender.tab?.id;
            if (typeof tid === 'number') {
              const map = await getTabMeta();
              if (map[tid]) {
                map[tid].formDirty = msg.dirty;
                await setTabMeta(map);
              }
            }
            sendResponse({ ok: true });
            return;
          }
          default: {
            const _exhaustive: never = msg;
            sendResponse({ ok: false, error: `unknown kind: ${JSON.stringify(_exhaustive)}` });
          }
        }
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return true; // async sendResponse
  });
}
