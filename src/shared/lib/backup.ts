import { z } from 'zod';
import { settingsSchema, type Settings } from '@/shared/schema/settings';

export const BACKUP_VERSION = 1;

export const backupSchema = z.object({
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.number(),
  settings: settingsSchema,
});
export type Backup = z.infer<typeof backupSchema>;

export function buildBackup(settings: Settings): Backup {
  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    settings,
  };
}

/**
 * 受け取った unknown 値を Backup として検証して返す。
 * 失敗時は Error を投げる (caller は catch して UI に表示する)。
 */
export function parseBackup(raw: unknown): Backup {
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' / '),
    );
  }
  return parsed.data;
}

export function backupFilename(now: number = Date.now()): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `tabzen-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}
