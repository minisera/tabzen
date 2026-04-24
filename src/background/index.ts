import { getSettings } from '@/shared/storage/settings';
import { bootstrapCurrentTabs, initTabMonitor } from './tab-monitor';
import { initMessaging } from './messaging';
import { closeAllInWindow, closeInactiveNow, runAutoClean } from './auto-cleaner';
import { closeDuplicates, findDuplicates } from './duplicate-finder';
import { getMruForWindow } from './mru-stack';
import { getTabMeta } from '@/shared/storage/local-state';
import { expireOldThumbnails, getThumbnails } from '@/shared/storage/thumbnails';
import type { ContentConfirmResponse, ContentRequest } from '@/shared/types';

const ALARM_SCAN = 'tab-tidy-scan';
const ALARM_PERIOD_MINUTES = 1;

console.log('[Tab Tidy] Service Worker booted');

async function scheduleScan(): Promise<void> {
  await chrome.alarms.create(ALARM_SCAN, { periodInMinutes: ALARM_PERIOD_MINUTES });
}

async function resolveWindowId(tab?: chrome.tabs.Tab): Promise<number | undefined> {
  if (typeof tab?.windowId === 'number') return tab.windowId;
  const current = await chrome.windows.getCurrent().catch(() => null);
  return typeof current?.id === 'number' ? current.id : undefined;
}

async function confirmInActiveTab(windowId: number, message: string): Promise<boolean> {
  const [active] = await chrome.tabs.query({ active: true, windowId });
  if (typeof active?.id !== 'number') return false;
  const req: ContentRequest = { kind: 'confirm', message };
  try {
    const res = (await chrome.tabs.sendMessage(active.id, req)) as
      | ContentConfirmResponse
      | undefined;
    return !!res?.ok;
  } catch {
    // Content Script が注入されないページ (chrome://, Web Store 等)
    return false;
  }
}

const CYCLE_TIMEOUT_MS = 1500;
let directCycle: {
  windowId: number;
  snapshot: number[];
  cursor: number;
  lastTick: number;
} | null = null;

async function tickDirectCycle(
  windowId: number,
  freshSnapshot: number[],
  direction: 'next' | 'prev',
): Promise<void> {
  if (freshSnapshot.length < 2) return;
  const now = Date.now();
  // cycle 継続中は初回取得した snapshot を維持する。タブ切替で MRU が
  // 更新されても snapshot を差し替えず、cursor だけ動かす。
  const continuing =
    directCycle !== null &&
    directCycle.windowId === windowId &&
    now - directCycle.lastTick < CYCLE_TIMEOUT_MS;

  if (continuing && directCycle) {
    const len = directCycle.snapshot.length;
    const delta = direction === 'next' ? 1 : -1;
    directCycle.cursor = (directCycle.cursor + delta + len) % len;
    directCycle.lastTick = now;
  } else {
    const len = freshSnapshot.length;
    const initialCursor = direction === 'next' ? Math.min(1, len - 1) : len - 1;
    directCycle = {
      windowId,
      snapshot: freshSnapshot,
      cursor: initialCursor,
      lastTick: now,
    };
  }
  const target = directCycle.snapshot[directCycle.cursor];
  if (typeof target === 'number') {
    try {
      await chrome.tabs.update(target, { active: true });
    } catch {
      directCycle = null;
    }
  }
}

async function handleTabSwitchFallback(
  tab: chrome.tabs.Tab | undefined,
  direction: 'next' | 'prev',
): Promise<void> {
  const win = await resolveWindowId(tab);
  if (typeof win !== 'number') {
    console.debug('[Tab Tidy] Alt+Q: no window');
    return;
  }
  const settings = await getSettings();
  const ids = (await getMruForWindow(win)).slice(0, settings.tabSwitcherMax);
  console.debug('[Tab Tidy] Alt+Q MRU ids:', ids, 'direction:', direction);
  if (ids.length < 2) return;

  const map = await getTabMeta();
  const thumbs = await getThumbnails();
  const items = ids
    .map((id) => {
      const meta = map[id];
      if (!meta) return null;
      return { ...meta, thumbnail: thumbs[id]?.dataUrl };
    })
    .filter((v): v is NonNullable<typeof v> => !!v);

  const [active] = await chrome.tabs.query({ active: true, windowId: win });
  if (typeof active?.id === 'number') {
    try {
      await chrome.tabs.sendMessage(active.id, {
        kind: 'tabSwitchCycle',
        direction,
        items,
      } satisfies ContentRequest);
      console.debug('[Tab Tidy] Alt+Q: overlay requested on tab', active.id);
      return;
    } catch (err) {
      console.debug('[Tab Tidy] Alt+Q: content script unreachable, falling back', err);
    }
  }
  await tickDirectCycle(win, ids, direction);
}

async function injectContentScriptIntoExistingTabs(): Promise<void> {
  const manifest = chrome.runtime.getManifest();
  const scripts = manifest.content_scripts ?? [];
  for (const cs of scripts) {
    const files = cs.js ?? [];
    const css = cs.css ?? [];
    if (files.length === 0 && css.length === 0) continue;
    const tabs = await chrome.tabs.query({ url: cs.matches });
    for (const tab of tabs) {
      if (typeof tab.id !== 'number') continue;
      if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) continue;
      try {
        if (files.length > 0) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: cs.all_frames },
            files,
          });
        }
      } catch (err) {
        console.debug('[Tab Tidy] inject skipped', tab.url, err);
      }
    }
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Tab Tidy] onInstalled:', details.reason);
  await bootstrapCurrentTabs();
  await scheduleScan();
  await injectContentScriptIntoExistingTabs();
});

chrome.runtime.onStartup.addListener(async () => {
  await bootstrapCurrentTabs();
  await scheduleScan();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_SCAN) return;
  const settings = await getSettings();
  const result = await runAutoClean(settings);
  if (result.suspended > 0 || result.closed > 0) {
    console.log('[Tab Tidy] auto clean:', result);
  }
  const removed = await expireOldThumbnails();
  if (removed > 0) {
    console.debug('[Tab Tidy] expired thumbnails:', removed);
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  const settings = await getSettings();
  switch (command) {
    case 'close-inactive-now': {
      const n = await closeInactiveNow(settings);
      console.log(`[Tab Tidy] close-inactive-now: ${n}`);
      return;
    }
    case 'close-duplicates': {
      const groups = await findDuplicates(settings);
      const total = groups.reduce((acc, g) => acc + g.tabs.length - 1, 0);
      if (total === 0) {
        console.log('[Tab Tidy] close-duplicates: none');
        return;
      }
      const win = await resolveWindowId(tab);
      if (typeof win !== 'number') return;
      const ok = await confirmInActiveTab(win, `${total} 個の重複タブを閉じます。よろしいですか？`);
      if (!ok) {
        console.log('[Tab Tidy] close-duplicates: cancelled');
        return;
      }
      const n = await closeDuplicates(settings);
      console.log(`[Tab Tidy] close-duplicates: ${n}`);
      return;
    }
    case 'close-all-window': {
      const win = await resolveWindowId(tab);
      if (typeof win !== 'number') return;
      const ok = await confirmInActiveTab(
        win,
        'このウィンドウの全タブ (除外タブを除く) を閉じます。よろしいですか？',
      );
      if (!ok) {
        console.log('[Tab Tidy] close-all-window: cancelled or no content script');
        return;
      }
      const n = await closeAllInWindow(win, settings);
      console.log(`[Tab Tidy] close-all-window: ${n}`);
      return;
    }
    case 'switch-tab-fallback': {
      await handleTabSwitchFallback(tab, 'next');
      return;
    }
    case 'switch-tab-fallback-prev': {
      await handleTabSwitchFallback(tab, 'prev');
      return;
    }
    default:
      console.warn('[Tab Tidy] unknown command:', command);
  }
});

initTabMonitor();
initMessaging();
void bootstrapCurrentTabs();
void scheduleScan();
