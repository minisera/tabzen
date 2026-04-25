import { describe, expect, it } from 'vitest';
import { exclusionReason, thresholdsForTab } from '@/background/auto-cleaner';
import { findDomainRule } from '@/shared/utils/url-normalize';
import type { TabMeta } from '@/shared/schema/tab-meta';
import { defaultSettings, type DomainRule, type Settings } from '@/shared/schema/settings';

function meta(partial: Partial<TabMeta>): TabMeta {
  return {
    tabId: 1,
    windowId: 1,
    url: 'https://example.com/',
    title: 'example',
    favIconUrl: undefined,
    lastActiveAt: 0,
    pinned: false,
    audible: false,
    groupId: undefined,
    formDirty: false,
    suspended: false,
    ...partial,
  };
}

function settingsWith(rules: DomainRule[], extra: Partial<Settings> = {}): Settings {
  return { ...defaultSettings, domainRules: rules, ...extra };
}

describe('findDomainRule', () => {
  const rules: DomainRule[] = [
    { pattern: 'github.com', mode: 'neverClose' },
    { pattern: '*.notion.so', mode: 'custom', suspendAfterMinutes: 60, closeAfterMinutes: 240 },
  ];

  it('returns null when no rule matches', () => {
    expect(findDomainRule('https://example.com/', rules)).toBeNull();
  });

  it('matches exact host', () => {
    expect(findDomainRule('https://github.com/', rules)?.pattern).toBe('github.com');
  });

  it('matches wildcard subdomain', () => {
    expect(findDomainRule('https://www.notion.so/x', rules)?.pattern).toBe('*.notion.so');
    expect(findDomainRule('https://notion.so/x', rules)?.pattern).toBe('*.notion.so');
  });

  it('returns first matching rule when multiple match', () => {
    const rs: DomainRule[] = [
      { pattern: '*.example.com', mode: 'custom', suspendAfterMinutes: 30, closeAfterMinutes: 60 },
      { pattern: 'a.example.com', mode: 'neverClose' },
    ];
    expect(findDomainRule('https://a.example.com/', rs)?.mode).toBe('custom');
  });
});

describe('exclusionReason with domainRules', () => {
  it('returns "domainRule" for neverClose match', () => {
    const s = settingsWith([{ pattern: 'github.com', mode: 'neverClose' }]);
    expect(exclusionReason(meta({ url: 'https://github.com/' }), s, new Set())).toBe('domainRule');
  });

  it('returns "none" for custom rule (does not exclude)', () => {
    const s = settingsWith([
      { pattern: 'youtube.com', mode: 'custom', suspendAfterMinutes: 60, closeAfterMinutes: 1440 },
    ]);
    expect(exclusionReason(meta({ url: 'https://youtube.com/' }), s, new Set())).toBe('none');
  });

  it('respects allowlist precedence over domainRule', () => {
    const s = settingsWith([{ pattern: 'github.com', mode: 'neverClose' }], {
      allowlist: ['github.com'],
    });
    // allowlist が先にチェックされるため "allowlisted" が返る
    expect(exclusionReason(meta({ url: 'https://github.com/' }), s, new Set())).toBe('allowlisted');
  });
});

describe('thresholdsForTab', () => {
  it('returns global thresholds when no rule matches', () => {
    const s = settingsWith([], { suspendAfterMinutes: 15, closeAfterMinutes: 60 });
    const t = thresholdsForTab(meta({ url: 'https://example.com/' }), s);
    expect(t.suspendMs).toBe(15 * 60_000);
    expect(t.closeMs).toBe(60 * 60_000);
  });

  it('overrides with custom rule thresholds', () => {
    const s = settingsWith([
      { pattern: 'youtube.com', mode: 'custom', suspendAfterMinutes: 120, closeAfterMinutes: 1440 },
    ]);
    const t = thresholdsForTab(meta({ url: 'https://youtube.com/' }), s);
    expect(t.suspendMs).toBe(120 * 60_000);
    expect(t.closeMs).toBe(1440 * 60_000);
  });

  it('falls back to global for neverClose rule (thresholds are not used anyway)', () => {
    const s = settingsWith([{ pattern: 'github.com', mode: 'neverClose' }], {
      suspendAfterMinutes: 15,
      closeAfterMinutes: 60,
    });
    const t = thresholdsForTab(meta({ url: 'https://github.com/' }), s);
    expect(t.suspendMs).toBe(15 * 60_000);
  });
});
