import dayjs from 'dayjs';
import { dailyStatsSchema, type DayStat } from '@/shared/schema/daily-stats';

const KEY = 'dailyStats';
const RETENTION_DAYS = 90;

export type DayStatField = 'autoClosed' | 'manualClosed' | 'suspended';

function todayKey(now: number = Date.now()): string {
  return dayjs(now).format('YYYY-MM-DD');
}

export async function getDailyStats(): Promise<DayStat[]> {
  const r = await chrome.storage.local.get(KEY);
  const parsed = dailyStatsSchema.safeParse(r[KEY]);
  return parsed.success ? parsed.data : [];
}

export async function setDailyStats(items: DayStat[]): Promise<void> {
  await chrome.storage.local.set({ [KEY]: items });
}

export async function clearDailyStats(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}

/**
 * 今日の集計値に delta を加える。retention を超えた古いエントリは
 * このタイミングで削除する。
 */
export async function recordDailyStat(field: DayStatField, delta: number): Promise<void> {
  if (delta <= 0) return;
  const list = await getDailyStats();
  const today = todayKey();
  const cutoff = dayjs(today).subtract(RETENTION_DAYS, 'day').format('YYYY-MM-DD');
  const filtered = list.filter((s) => s.date >= cutoff);
  const idx = filtered.findIndex((s) => s.date === today);
  if (idx === -1) {
    filtered.push({ date: today, autoClosed: 0, manualClosed: 0, suspended: 0, [field]: delta });
  } else {
    filtered[idx] = { ...filtered[idx], [field]: filtered[idx][field] + delta };
  }
  filtered.sort((a, b) => a.date.localeCompare(b.date));
  await setDailyStats(filtered);
}
