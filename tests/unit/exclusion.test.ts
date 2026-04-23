import { describe, expect, it } from 'vitest';
import { exclusionReason } from '@/background/auto-cleaner';
import type { TabMeta } from '@/shared/schema/tab-meta';
import { defaultSettings } from '@/shared/schema/settings';

function meta(partial: Partial<TabMeta>): TabMeta {
  return {
    tabId: 1,
    windowId: 1,
    url: 'https://example.com/',
    title: 'example',
    favIconUrl: undefined,
    lastActiveAt: Date.now() - 60 * 60 * 1000,
    pinned: false,
    audible: false,
    groupId: undefined,
    formDirty: false,
    suspended: false,
    ...partial,
  };
}

describe('exclusionReason', () => {
  it('returns "pinned" for pinned tabs', () => {
    expect(exclusionReason(meta({ pinned: true }), defaultSettings, new Set())).toBe('pinned');
  });

  it('returns "audible" for audible tabs', () => {
    expect(exclusionReason(meta({ audible: true }), defaultSettings, new Set())).toBe('audible');
  });

  it('returns "formDirty" when a form is being edited', () => {
    expect(exclusionReason(meta({ formDirty: true }), defaultSettings, new Set())).toBe(
      'formDirty',
    );
  });

  it('returns "active" when tab is in the active set', () => {
    expect(exclusionReason(meta({ tabId: 42 }), defaultSettings, new Set([42]))).toBe('active');
  });

  it('returns "allowlisted" when URL matches allowlist', () => {
    const settings = { ...defaultSettings, allowlist: ['example.com'] };
    expect(exclusionReason(meta({}), settings, new Set())).toBe('allowlisted');
  });

  it('returns "none" for an otherwise unexceptional tab', () => {
    expect(exclusionReason(meta({}), defaultSettings, new Set())).toBe('none');
  });

  it('respects precedence: pinned before active', () => {
    // pinned かつ active でも "pinned" が優先される
    expect(exclusionReason(meta({ pinned: true, tabId: 1 }), defaultSettings, new Set([1]))).toBe(
      'pinned',
    );
  });
});
