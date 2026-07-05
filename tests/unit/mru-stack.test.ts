import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('mru-stack', () => {
  it('bringToFront inserts new tab id at head', async () => {
    const { bringToFront, getMruForWindow } = await import('@/background/mru-stack');
    await bringToFront(1, 10);
    await bringToFront(1, 20);
    expect(await getMruForWindow(1)).toEqual([20, 10]);
  });

  it('bringToFront deduplicates existing tab ids', async () => {
    const { bringToFront, getMruForWindow } = await import('@/background/mru-stack');
    await bringToFront(1, 10);
    await bringToFront(1, 20);
    await bringToFront(1, 10); // 再訪
    expect(await getMruForWindow(1)).toEqual([10, 20]);
  });

  it('removeTab removes id from specified window', async () => {
    const { bringToFront, removeTab, getMruForWindow } = await import('@/background/mru-stack');
    await bringToFront(1, 10);
    await bringToFront(1, 20);
    await removeTab(10, 1);
    expect(await getMruForWindow(1)).toEqual([20]);
  });

  it('removeTab removes id from all windows when windowId omitted', async () => {
    const { bringToFront, removeTab, getMruForWindow } = await import('@/background/mru-stack');
    await bringToFront(1, 10);
    await bringToFront(2, 10);
    await removeTab(10);
    expect(await getMruForWindow(1)).toEqual([]);
    expect(await getMruForWindow(2)).toEqual([]);
  });

  it('maintains separate stacks per window', async () => {
    const { bringToFront, getMruForWindow } = await import('@/background/mru-stack');
    await bringToFront(1, 10);
    await bringToFront(2, 20);
    expect(await getMruForWindow(1)).toEqual([10]);
    expect(await getMruForWindow(2)).toEqual([20]);
  });

  it('cleanupStacksForKnownTabs prunes unknown ids', async () => {
    const { bringToFront, cleanupStacksForKnownTabs, getMruForWindow } =
      await import('@/background/mru-stack');
    await bringToFront(1, 10);
    await bringToFront(1, 20);
    await bringToFront(1, 30);
    await cleanupStacksForKnownTabs(new Set([10, 30]));
    expect(await getMruForWindow(1)).toEqual([30, 10]);
  });
});

describe('insertAfterOpener', () => {
  it('inserts new tab right after the opener', async () => {
    const { bringToFront, insertAfterOpener, getMruForWindow } =
      await import('@/background/mru-stack');
    await bringToFront(1, 10); // opener = 10, stack = [10]
    await insertAfterOpener(1, 20, 10);
    expect(await getMruForWindow(1)).toEqual([10, 20]);
  });

  it('keeps the most recently opened linked tab nearest the opener', async () => {
    const { bringToFront, insertAfterOpener, getMruForWindow } =
      await import('@/background/mru-stack');
    await bringToFront(1, 10); // [10]
    await insertAfterOpener(1, 20, 10); // [10, 20]
    await insertAfterOpener(1, 30, 10); // [10, 30, 20]
    await insertAfterOpener(1, 40, 10); // [10, 40, 30, 20]
    expect(await getMruForWindow(1)).toEqual([10, 40, 30, 20]);
  });

  it('falls back to index 1 when the opener is not in the stack', async () => {
    const { bringToFront, insertAfterOpener, getMruForWindow } =
      await import('@/background/mru-stack');
    await bringToFront(1, 10); // [10]
    await insertAfterOpener(1, 20, 999); // opener 不在 → index 1
    expect(await getMruForWindow(1)).toEqual([10, 20]);
  });

  it('deduplicates when the tab already exists in the stack', async () => {
    const { bringToFront, insertAfterOpener, getMruForWindow } =
      await import('@/background/mru-stack');
    await bringToFront(1, 10);
    await bringToFront(1, 20); // [20, 10]
    await insertAfterOpener(1, 20, 10); // 20 を除去後、opener 10 の直後へ → [10, 20]
    expect(await getMruForWindow(1)).toEqual([10, 20]);
  });
});
