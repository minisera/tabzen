import { getSettings } from '@/shared/storage/settings';
import { bootstrapCurrentTabs, initTabMonitor } from './tab-monitor';
import { initMessaging } from './messaging';
import { closeAllInWindow, closeInactiveNow, runAutoClean } from './auto-cleaner';
import { closeDuplicates, findDuplicates } from './duplicate-finder';
import { getMruForWindow } from './mru-stack';
import { getTabMeta } from '@/shared/storage/local-state';
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

const CYCLE_MAX = 5;
const CYCLE_TIMEOUT_MS = 1500;
let directCycle: {
  windowId: number;
  snapshot: number[];
  cursor: number;
  lastTick: number;
} | null = null;

function snapshotEquals(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function tickDirectCycle(windowId: number, snapshot: number[]): Promise<void> {
  if (snapshot.length < 2) return;
  const now = Date.now();
  const continuing =
    directCycle !== null &&
    directCycle.windowId === windowId &&
    now - directCycle.lastTick < CYCLE_TIMEOUT_MS &&
    snapshotEquals(directCycle.snapshot, snapshot);

  if (continuing && directCycle) {
    directCycle.cursor = (directCycle.cursor + 1) % directCycle.snapshot.length;
    directCycle.lastTick = now;
  } else {
    directCycle = {
      windowId,
      snapshot,
      cursor: Math.min(1, snapshot.length - 1),
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

async function handleTabSwitchFallback(tab: chrome.tabs.Tab | undefined): Promise<void> {
  const win = await resolveWindowId(tab);
  if (typeof win !== 'number') return;
  const ids = (await getMruForWindow(win)).slice(0, CYCLE_MAX);
  if (ids.length < 2) return;

  const map = await getTabMeta();
  const items = ids.map((id) => map[id]).filter((v): v is NonNullable<typeof v> => !!v);

  const [active] = await chrome.tabs.query({ active: true, windowId: win });
  if (typeof active?.id === 'number') {
    try {
      await chrome.tabs.sendMessage(active.id, {
        kind: 'tabSwitchNext',
        items,
      } satisfies ContentRequest);
      return;
    } catch {
      // Content Script が動かないページ → 直接切替にフォールバック
    }
  }
  await tickDirectCycle(win, ids);
}

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Tab Tidy] onInstalled:', details.reason);
  await bootstrapCurrentTabs();
  await scheduleScan();
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
      await handleTabSwitchFallback(tab);
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
