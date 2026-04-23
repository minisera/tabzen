import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ja';

dayjs.extend(relativeTime);
dayjs.locale('ja');

export function relativeFromNow(ms: number): string {
  return dayjs(ms).fromNow();
}

export function minutesToMs(minutes: number): number {
  return minutes * 60_000;
}

export function msToMinutes(ms: number): number {
  return Math.floor(ms / 60_000);
}
