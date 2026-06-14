import { describe, expect, it } from 'vitest';
import { defaultSettings, settingsSchema } from '@/shared/schema/settings';

describe('settingsSchema', () => {
  it('produces sensible defaults', () => {
    expect(defaultSettings.enabled).toBe(true);
    expect(defaultSettings.suspendAfterMinutes).toBeLessThan(defaultSettings.closeAfterMinutes);
    expect(defaultSettings.domainRules).toEqual([]);
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
      domainRules: [
        { pattern: 'github.com', mode: 'neverClose' },
        { pattern: '*.notion.so', mode: 'neverClose' },
      ],
    });
    expect(res.success).toBe(true);
  });

  it('defaults tabSwitcherLayout to vertical', () => {
    expect(defaultSettings.tabSwitcherLayout).toBe('vertical');
  });

  it('accepts horizontal tabSwitcherLayout', () => {
    const res = settingsSchema.safeParse({ ...defaultSettings, tabSwitcherLayout: 'horizontal' });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.tabSwitcherLayout).toBe('horizontal');
  });

  it('rejects an unknown tabSwitcherLayout value', () => {
    const res = settingsSchema.safeParse({ ...defaultSettings, tabSwitcherLayout: 'diagonal' });
    expect(res.success).toBe(false);
  });

  it('defaults tabSwitcherWrap to false (single-row by default)', () => {
    expect(defaultSettings.tabSwitcherWrap).toBe(false);
  });

  it('defaults tabSwitcherColumns to 4', () => {
    expect(defaultSettings.tabSwitcherColumns).toBe(4);
  });

  it('accepts tabSwitcherWrap and tabSwitcherColumns', () => {
    const res = settingsSchema.safeParse({
      ...defaultSettings,
      tabSwitcherWrap: true,
      tabSwitcherColumns: 6,
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.tabSwitcherWrap).toBe(true);
    expect(res.data.tabSwitcherColumns).toBe(6);
  });

  it('enforces tabSwitcherColumns bounds (2-8)', () => {
    const tooFew = settingsSchema.safeParse({ ...defaultSettings, tabSwitcherColumns: 1 });
    const tooMany = settingsSchema.safeParse({ ...defaultSettings, tabSwitcherColumns: 9 });
    expect(tooFew.success).toBe(false);
    expect(tooMany.success).toBe(false);
  });

  it('enforces restore history bounds', () => {
    const tooFew = settingsSchema.safeParse({ ...defaultSettings, restoreHistoryLimit: 1 });
    const tooMany = settingsSchema.safeParse({ ...defaultSettings, restoreHistoryLimit: 5000 });
    expect(tooFew.success).toBe(false);
    expect(tooMany.success).toBe(false);
  });

  it('migrates legacy allowlist into domainRules as neverClose entries', () => {
    const res = settingsSchema.safeParse({
      allowlist: ['github.com', '*.notion.so'],
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).not.toHaveProperty('allowlist');
    expect(res.data.domainRules).toEqual([
      { pattern: 'github.com', mode: 'neverClose' },
      { pattern: '*.notion.so', mode: 'neverClose' },
    ]);
  });

  it('prepends migrated allowlist entries before existing domainRules', () => {
    const res = settingsSchema.safeParse({
      allowlist: ['github.com'],
      domainRules: [{ pattern: 'youtube.com', mode: 'neverClose' }],
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.domainRules.map((r) => r.pattern)).toEqual(['github.com', 'youtube.com']);
  });

  it('skips legacy allowlist patterns that already exist as domainRules', () => {
    const res = settingsSchema.safeParse({
      allowlist: ['github.com'],
      domainRules: [
        { pattern: 'github.com', mode: 'custom', suspendAfterMinutes: 60, closeAfterMinutes: 240 },
      ],
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    // 既存の custom ルールが allowlist 由来の neverClose に上書きされない
    expect(res.data.domainRules).toHaveLength(1);
    expect(res.data.domainRules[0]?.mode).toBe('custom');
  });

  it('drops empty legacy allowlist without touching domainRules', () => {
    const res = settingsSchema.safeParse({
      allowlist: [],
      domainRules: [{ pattern: 'github.com', mode: 'neverClose' }],
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).not.toHaveProperty('allowlist');
    expect(res.data.domainRules).toHaveLength(1);
  });
});
