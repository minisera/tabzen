import { beforeEach, describe, expect, it, vi } from 'vitest';

// mru-stack.test.ts と同じ in-memory storage スタブ。
// グローバル chrome モックは無い方針なので毎テストで stub する。
function createStorageArea() {
  const store: Record<string, unknown> = {};
  return {
    _data: store,
    async get(keys: string | string[] | Record<string, unknown> | null) {
      if (keys === null || keys === undefined) return { ...store };
      if (typeof keys === 'string') return { [keys]: store[keys] };
      if (Array.isArray(keys)) {
        const out: Record<string, unknown> = {};
        for (const k of keys) out[k] = store[k];
        return out;
      }
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(keys)) {
        out[k] = store[k] ?? (keys as Record<string, unknown>)[k];
      }
      return out;
    },
    async set(items: Record<string, unknown>) {
      Object.assign(store, items);
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('chrome', {
    storage: {
      local: createStorageArea(),
      sync: createStorageArea(),
    },
  });
});

async function writeSettings(partial: Record<string, unknown>): Promise<void> {
  const { defaultSettings } = await import('@/shared/schema/settings');
  await chrome.storage.sync.set({ settings: { ...defaultSettings, ...partial } });
}

describe('tab-monitor handleCreated', () => {
  it('inserts a linked background tab after its opener when enabled', async () => {
    await writeSettings({ insertLinkedTabsAfterActive: true });
    const { bringToFront, getMruForWindow } = await import('@/background/mru-stack');
    const { handleCreated } = await import('@/background/tab-monitor');
    await bringToFront(1, 10); // opener = 10
    await handleCreated({ id: 20, windowId: 1, openerTabId: 10, active: false } as chrome.tabs.Tab);
    expect(await getMruForWindow(1)).toEqual([10, 20]);
  });

  it('does nothing when the setting is off', async () => {
    await writeSettings({ insertLinkedTabsAfterActive: false });
    const { bringToFront, getMruForWindow } = await import('@/background/mru-stack');
    const { handleCreated } = await import('@/background/tab-monitor');
    await bringToFront(1, 10);
    await handleCreated({ id: 20, windowId: 1, openerTabId: 10, active: false } as chrome.tabs.Tab);
    expect(await getMruForWindow(1)).toEqual([10]);
  });

  it('ignores tabs without an openerTabId (e.g. Cmd+T)', async () => {
    await writeSettings({ insertLinkedTabsAfterActive: true });
    const { bringToFront, getMruForWindow } = await import('@/background/mru-stack');
    const { handleCreated } = await import('@/background/tab-monitor');
    await bringToFront(1, 10);
    await handleCreated({ id: 20, windowId: 1, active: false } as chrome.tabs.Tab);
    expect(await getMruForWindow(1)).toEqual([10]);
  });

  it('ignores foreground tabs (active=true) — onActivated handles those', async () => {
    await writeSettings({ insertLinkedTabsAfterActive: true });
    const { bringToFront, getMruForWindow } = await import('@/background/mru-stack');
    const { handleCreated } = await import('@/background/tab-monitor');
    await bringToFront(1, 10);
    await handleCreated({ id: 20, windowId: 1, openerTabId: 10, active: true } as chrome.tabs.Tab);
    expect(await getMruForWindow(1)).toEqual([10]);
  });

  // メタ更新は元 onCreated の責務。handleCreated は MRU 挿入対象外のタブ
  // (openerTabId 無し = Cmd+T 等) でも upsertMeta を必ず走らせること。
  it('updates tab metadata via upsertMeta even for non-linked tabs', async () => {
    await writeSettings({ insertLinkedTabsAfterActive: true });
    const { getTabMeta } = await import('@/shared/storage/local-state');
    const { handleCreated } = await import('@/background/tab-monitor');
    await handleCreated({
      id: 20,
      windowId: 1,
      active: false,
      url: 'https://example.com/',
      title: 'Example',
    } as chrome.tabs.Tab);
    const meta = await getTabMeta();
    expect(meta[20]?.url).toBe('https://example.com/');
    expect(meta[20]?.title).toBe('Example');
  });

  // id / windowId が欠落したタブでは早期 return: 例外を投げず、MRU にも
  // メタにも何も書かない (upsertMeta 内の toMeta が null を返す)。
  it('returns early for tabs missing id or windowId (no insert, no throw, no meta)', async () => {
    await writeSettings({ insertLinkedTabsAfterActive: true });
    const { bringToFront, getMruForWindow } = await import('@/background/mru-stack');
    const { getTabMeta } = await import('@/shared/storage/local-state');
    const { handleCreated } = await import('@/background/tab-monitor');
    await bringToFront(1, 10);
    await handleCreated({ windowId: 1, openerTabId: 10, active: false } as chrome.tabs.Tab); // id 欠落
    await handleCreated({ id: 20, openerTabId: 10, active: false } as chrome.tabs.Tab); // windowId 欠落
    expect(await getMruForWindow(1)).toEqual([10]);
    expect((await getTabMeta())[20]).toBeUndefined();
  });
});
