import dayjs from 'dayjs';

export interface SnoozePreset {
  id: string;
  label: string;
  /** 現在時刻 now (ms) を受け取って起動予定時刻 (ms) を返す */
  resolve(now: number): number;
}

/**
 * "今日の H 時、ただし既に過ぎていれば翌日の H 時" を返す。
 * Snooze 用途では「今晩 18 時」のような『次に来る H 時』が直感的。
 */
function nextAtHour(now: number, hour: number, minute = 0): number {
  const today = dayjs(now).hour(hour).minute(minute).second(0).millisecond(0);
  return today.valueOf() <= now ? today.add(1, 'day').valueOf() : today.valueOf();
}

/** dayjs の day(): 日=0, 月=1, ..., 土=6 */
function nextWeekdayAt(now: number, targetDay: number, hour: number, minute = 0): number {
  const base = dayjs(now);
  const cur = base.day();
  // 同じ曜日でも時刻が過ぎていたら来週扱い
  let delta = (targetDay - cur + 7) % 7;
  const candidate = base.hour(hour).minute(minute).second(0).millisecond(0);
  if (delta === 0 && candidate.valueOf() <= now) delta = 7;
  return candidate.add(delta, 'day').valueOf();
}

export const SNOOZE_PRESETS: SnoozePreset[] = [
  { id: '30m', label: '30 分後', resolve: (now) => now + 30 * 60_000 },
  { id: '1h', label: '1 時間後', resolve: (now) => now + 60 * 60_000 },
  { id: '3h', label: '3 時間後', resolve: (now) => now + 3 * 60 * 60_000 },
  { id: 'tonight', label: '今晩 18:00', resolve: (now) => nextAtHour(now, 18) },
  { id: 'tomorrow', label: '明朝 09:00', resolve: (now) => nextAtHour(now, 9) },
  // 1 = 月曜
  { id: 'next-mon', label: '来週月曜 09:00', resolve: (now) => nextWeekdayAt(now, 1, 9) },
];
