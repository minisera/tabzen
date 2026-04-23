import { getSettings } from '@/shared/storage/settings';
import { bootstrapCurrentTabs, initTabMonitor } from './tab-monitor';
import { initMessaging } from './messaging';
import { closeAllInWindow, closeInactiveNow, runAutoClean } from './auto-cleaner';
import { closeDuplicates } from './duplicate-finder';
import { getMruForWindow } from './mru-stack';

const ALARM_SCAN = 'tab-tidy-scan';
const ALARM_PERIOD_MINUTES = 1;

console.log('[Tab Tidy] Service Worker booted');

async function scheduleScan(): Promise<void> {
  await chrome.alarms.create(ALARM_SCAN, { periodInMinutes: ALARM_PERIOD_MINUTES });
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
      const n = await closeDuplicates(settings);
      console.log(`[Tab Tidy] close-duplicates: ${n}`);
      return;
    }
    case 'close-all-window': {
      const win =
        tab?.windowId ?? (await chrome.windows.getCurrent().catch(() => null))?.id ?? undefined;
      if (typeof win === 'number') {
        const n = await closeAllInWindow(win, settings);
        console.log(`[Tab Tidy] close-all-window: ${n}`);
      }
      return;
    }
    case 'switch-tab-fallback': {
      // Phase 5 で Content Script オーバーレイと統合する。
      // フォールバックとして、MRU 2 番目のタブに直接切り替える。
      const win = tab?.windowId ?? (await chrome.windows.getCurrent().catch(() => null))?.id;
      if (typeof win === 'number') {
        const ids = await getMruForWindow(win);
        const nextId = ids[1];
        if (typeof nextId === 'number') {
          try {
            await chrome.tabs.update(nextId, { active: true });
          } catch {
            // ignore
          }
        }
      }
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
