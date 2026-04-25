import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import {
  getDailyStats,
  recordDailyStat,
  setDailyStats,
  clearDailyStats,
} from '@/shared/storage/daily-stats';

interface FakeStorage {
  data: Record<string, unknown>;
}

function installFakeStorage() {
  const store: FakeStorage = { data: {} };
  const local = {
    get: vi.fn(async (k: string) => ({ [k]: store.data[k] })),
    set: vi.fn(async (obj: Record<string, unknown>) => {
      Object.assign(store.data, obj);
    }),
    remove: vi.fn(async (k: string) => {
      delete store.data[k];
    }),
  };
  // happy-dom doesn't have chrome by default
  (globalThis as unknown as { chrome: { storage: { local: typeof local } } }).chrome = {
    storage: { local },
  };
  return store;
}

describe('daily-stats storage', () => {
  let store: FakeStorage;

  beforeEach(() => {
    store = installFakeStorage();
  });

  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it('returns empty array when no data', async () => {
    expect(await getDailyStats()).toEqual([]);
  });

  it('records a new entry for today', async () => {
    await recordDailyStat('autoClosed', 3);
    const list = await getDailyStats();
    expect(list).toHaveLength(1);
    expect(list[0].autoClosed).toBe(3);
    expect(list[0].date).toBe(dayjs().format('YYYY-MM-DD'));
  });

  it('accumulates into the same day', async () => {
    await recordDailyStat('autoClosed', 2);
    await recordDailyStat('autoClosed', 5);
    await recordDailyStat('manualClosed', 1);
    const list = await getDailyStats();
    expect(list).toHaveLength(1);
    expect(list[0].autoClosed).toBe(7);
    expect(list[0].manualClosed).toBe(1);
  });

  it('skips when delta is 0 or negative', async () => {
    await recordDailyStat('autoClosed', 0);
    expect(await getDailyStats()).toEqual([]);
    await recordDailyStat('autoClosed', -5);
    expect(await getDailyStats()).toEqual([]);
  });

  it('drops entries older than 90 days', async () => {
    const old = dayjs().subtract(120, 'day').format('YYYY-MM-DD');
    const recent = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
    await setDailyStats([
      { date: old, autoClosed: 100, manualClosed: 0, suspended: 0 },
      { date: recent, autoClosed: 5, manualClosed: 0, suspended: 0 },
    ]);
    await recordDailyStat('autoClosed', 1);
    const list = await getDailyStats();
    expect(list.find((s) => s.date === old)).toBeUndefined();
    expect(list.find((s) => s.date === recent)?.autoClosed).toBe(5);
    expect(store.data.dailyStats).toBeDefined();
  });

  it('clearDailyStats removes the key', async () => {
    await recordDailyStat('autoClosed', 3);
    await clearDailyStats();
    expect(await getDailyStats()).toEqual([]);
  });
});
