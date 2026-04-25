import { getSnoozedTabs, setSnoozedTabs } from '@/shared/storage/snooze';
import type { SnoozedTab } from '@/shared/schema/snooze';

const ALARM_PREFIX = 'tabzen-snooze:';

function alarmName(id: string): string {
  return `${ALARM_PREFIX}${id}`;
}

export function isSnoozeAlarm(name: string): boolean {
  return name.startsWith(ALARM_PREFIX);
}

export function snoozeIdFromAlarm(name: string): string {
  return name.slice(ALARM_PREFIX.length);
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback (テスト環境など): 衝突しなければ十分。
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function snoozeTab(tabId: number, wakeAt: number): Promise<SnoozedTab> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) throw new Error('タブの URL を取得できませんでした');
  const entry: SnoozedTab = {
    id: uuid(),
    url: tab.url,
    title: tab.title ?? tab.url,
    favIconUrl: tab.favIconUrl,
    snoozedAt: Date.now(),
    wakeAt,
  };
  const list = await getSnoozedTabs();
  await setSnoozedTabs([entry, ...list]);
  await chrome.alarms.create(alarmName(entry.id), { when: wakeAt });
  try {
    await chrome.tabs.remove(tabId);
  } catch {
    // 既に閉じられていた / pinned 等。アラームは残しておけば後で起動する。
  }
  return entry;
}

export async function listSnoozed(): Promise<SnoozedTab[]> {
  return getSnoozedTabs();
}

export async function cancelSnooze(id: string): Promise<void> {
  const list = await getSnoozedTabs();
  await setSnoozedTabs(list.filter((s) => s.id !== id));
  await chrome.alarms.clear(alarmName(id));
}

export async function wakeSnoozeNow(id: string): Promise<void> {
  const list = await getSnoozedTabs();
  const entry = list.find((s) => s.id === id);
  if (!entry) return;
  await wakeEntry(entry);
}

async function wakeEntry(entry: SnoozedTab): Promise<void> {
  await chrome.tabs.create({ url: entry.url, active: false });
  const list = await getSnoozedTabs();
  await setSnoozedTabs(list.filter((s) => s.id !== entry.id));
  await chrome.alarms.clear(alarmName(entry.id));
}

export async function handleSnoozeAlarm(alarmName: string): Promise<void> {
  const id = snoozeIdFromAlarm(alarmName);
  const list = await getSnoozedTabs();
  const entry = list.find((s) => s.id === id);
  if (!entry) return;
  await wakeEntry(entry);
}

/**
 * Service Worker は再起動するため、起動時にすべての snooze エントリの
 * アラームを再スケジュールする。既に過去のものは即座に起動する。
 */
export async function bootstrapSnoozeAlarms(): Promise<void> {
  const list = await getSnoozedTabs();
  const now = Date.now();
  for (const entry of list) {
    if (entry.wakeAt <= now) {
      await wakeEntry(entry);
    } else {
      await chrome.alarms.create(alarmName(entry.id), { when: entry.wakeAt });
    }
  }
}
