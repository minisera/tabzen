import { describe, expect, it } from 'vitest';
import { defaultSettings, settingsSchema } from '@/shared/schema/settings';

describe('settingsSchema', () => {
  it('produces sensible defaults', () => {
    expect(defaultSettings.enabled).toBe(true);
    expect(defaultSettings.suspendAfterMinutes).toBeLessThan(defaultSettings.closeAfterMinutes);
    expect(defaultSettings.allowlist).toEqual([]);
    expect(defaultSettings.restoreHistoryLimit).toBeGreaterThanOrEqual(10);
  });

  it('rejects suspend >= close', () => {
    const res = settingsSchema.safeParse({
      ...defaultSettings,
      suspendAfterMinutes: 60,
      closeAfterMinutes: 30,
    });
    expect(res.success).toBe(false);
  });

  it('accepts valid settings', () => {
    const res = settingsSchema.safeParse({
      ...defaultSettings,
      suspendAfterMinutes: 10,
      closeAfterMinutes: 120,
      allowlist: ['github.com', '*.notion.so'],
    });
    expect(res.success).toBe(true);
  });

  it('enforces restore history bounds', () => {
    const tooFew = settingsSchema.safeParse({ ...defaultSettings, restoreHistoryLimit: 1 });
    const tooMany = settingsSchema.safeParse({ ...defaultSettings, restoreHistoryLimit: 5000 });
    expect(tooFew.success).toBe(false);
    expect(tooMany.success).toBe(false);
  });
});
