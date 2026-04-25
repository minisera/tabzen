import { describe, expect, it } from 'vitest';
import { BACKUP_VERSION, backupFilename, buildBackup, parseBackup } from '@/shared/lib/backup';
import { defaultSettings } from '@/shared/schema/settings';

describe('buildBackup / parseBackup', () => {
  it('round trips default settings', () => {
    const b = buildBackup(defaultSettings);
    expect(b.version).toBe(BACKUP_VERSION);
    const json = JSON.stringify(b);
    const restored = parseBackup(JSON.parse(json));
    expect(restored.settings).toEqual(defaultSettings);
  });

  it('rejects payload without version', () => {
    expect(() => parseBackup({ settings: defaultSettings, exportedAt: 0 })).toThrow();
  });

  it('rejects payload with wrong version', () => {
    expect(() => parseBackup({ version: 999, settings: defaultSettings, exportedAt: 0 })).toThrow();
  });

  it('rejects payload where settings violate schema', () => {
    expect(() =>
      parseBackup({
        version: BACKUP_VERSION,
        exportedAt: 0,
        settings: {
          ...defaultSettings,
          // suspendAfterMinutes >= closeAfterMinutes は schema が拒否する
          suspendAfterMinutes: 9999,
          closeAfterMinutes: 1,
        },
      }),
    ).toThrow();
  });

  it('rejects non-object payload', () => {
    expect(() => parseBackup('hello')).toThrow();
    expect(() => parseBackup(null)).toThrow();
  });
});

describe('backupFilename', () => {
  it('produces a filename containing the date', () => {
    const fname = backupFilename(new Date('2026-04-25T13:09:00').getTime());
    expect(fname).toMatch(/^tabzen-backup-20260425-\d{4}\.json$/);
  });
});
