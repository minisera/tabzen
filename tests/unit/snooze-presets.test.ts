import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { SNOOZE_PRESETS } from '@/shared/utils/snooze-presets';

const byId = (id: string) => SNOOZE_PRESETS.find((p) => p.id === id)!;

describe('SNOOZE_PRESETS', () => {
  it('30m / 1h / 3h add fixed durations', () => {
    const now = dayjs('2026-04-25T12:00:00Z').valueOf();
    expect(byId('30m').resolve(now) - now).toBe(30 * 60_000);
    expect(byId('1h').resolve(now) - now).toBe(60 * 60_000);
    expect(byId('3h').resolve(now) - now).toBe(3 * 60 * 60_000);
  });

  it('tonight resolves to today 18:00 if before, tomorrow 18:00 if after', () => {
    // 14:00 → today 18:00
    const beforeEvening = dayjs('2026-04-25T14:00:00').valueOf();
    expect(dayjs(byId('tonight').resolve(beforeEvening)).hour()).toBe(18);
    expect(dayjs(byId('tonight').resolve(beforeEvening)).date()).toBe(25);

    // 19:00 → tomorrow 18:00
    const afterEvening = dayjs('2026-04-25T19:00:00').valueOf();
    const r = dayjs(byId('tonight').resolve(afterEvening));
    expect(r.hour()).toBe(18);
    expect(r.date()).toBe(26);
  });

  it('tomorrow resolves to next 09:00', () => {
    const now = dayjs('2026-04-25T14:00:00').valueOf();
    const r = dayjs(byId('tomorrow').resolve(now));
    expect(r.hour()).toBe(9);
    expect(r.date()).toBe(26);
  });

  it('next-mon resolves to upcoming Monday 09:00', () => {
    // 2026-04-25 is a Saturday → next Mon is 2026-04-27
    const sat = dayjs('2026-04-25T14:00:00').valueOf();
    const r = dayjs(byId('next-mon').resolve(sat));
    expect(r.day()).toBe(1);
    expect(r.hour()).toBe(9);
    expect(r.date()).toBe(27);
  });

  it('next-mon on Monday before 9 stays the same Monday', () => {
    // 2026-04-27 is Monday
    const monMorning = dayjs('2026-04-27T07:00:00').valueOf();
    const r = dayjs(byId('next-mon').resolve(monMorning));
    expect(r.date()).toBe(27);
    expect(r.hour()).toBe(9);
  });

  it('next-mon on Monday after 9 jumps to following week', () => {
    const monAfternoon = dayjs('2026-04-27T14:00:00').valueOf();
    const r = dayjs(byId('next-mon').resolve(monAfternoon));
    expect(r.day()).toBe(1);
    expect(r.diff(dayjs(monAfternoon).hour(9).minute(0).second(0).millisecond(0), 'day')).toBe(7);
  });
});
