import { beforeEach, describe, expect, it, vi } from 'vitest';

// mru-stack.test.ts / tab-monitor.test.ts と同じ in-memory storage スタブ。
// グローバル chrome モックは無い方針なので毎テストで stub する。
//
// このスタブは通常版と 2 点違う:
//   1. get(null) (= 全件読み) を例外にする。単一キーへの全件詰め込みが
//      Ctrl+Q を遅くしていた原因なので、どの関数であれ全件読みに戻したら
//      その場でテストが落ちるようにする。
//   2. 書き込みバイト数を累積する。「1 件追加のコストが既存件数に
//      比例しない」ことを assert するために使う。
function createLocalArea() {
  const store: Record<string, unknown> = {};
  const stats = { writtenBytes: 0, readBytes: 0 };
  return {
    _data: store,
    _stats: stats,
    async get(keys: string | string[] | null | undefined) {
      if (keys === null || keys === undefined) {
        throw new Error('全件読み (storage.local.get(null)) は許可されていない');
      }
      const list = typeof keys === 'string' ? [keys] : keys;
      const out: Record<string, unknown> = {};
      for (const k of list) if (k in store) out[k] = store[k];
      stats.readBytes += JSON.stringify(out).length;
      return out;
    },
    async set(items: Record<string, unknown>) {
      stats.writtenBytes += JSON.stringify(items).length;
      Object.assign(store, items);
    },
    async remove(keys: string | string[]) {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
    },
    async getKeys() {
      return Object.keys(store);
    },
  };
}

let local: ReturnType<typeof createLocalArea>;

beforeEach(() => {
  local = createLocalArea();
  vi.stubGlobal('chrome', { storage: { local } });
});

// 実物のサムネイル (JPEG q40 のフルスクリーンショット) は実測で 1 枚
// 数十 KB あった。書き込み量の assert が意味を持つサイズにしておく。
const KB = 1024;
function fakeDataUrl(tabId: number, kb = 8): string {
  return `data:image/jpeg;base64,${String(tabId).padStart(4, '0')}${'A'.repeat(kb * KB)}`;
}

async function seed(count: number): Promise<void> {
  const { setThumbnail } = await import('@/shared/storage/thumbnails');
  for (let i = 1; i <= count; i++) await setThumbnail(i, fakeDataUrl(i));
}

describe('thumbnails storage', () => {
  it('要求した tabId の分だけ読み出す', async () => {
    const { getThumbnails } = await import('@/shared/storage/thumbnails');
    await seed(100);

    const got = await getThumbnails([3, 7]);

    expect(Object.keys(got).sort()).toEqual(['3', '7']);
    expect(got[3]?.dataUrl).toBe(fakeDataUrl(3));
  });

  it('存在しない tabId は黙って除外する', async () => {
    const { getThumbnails } = await import('@/shared/storage/thumbnails');
    await seed(3);

    const got = await getThumbnails([2, 999]);

    expect(Object.keys(got)).toEqual(['2']);
  });

  it('1 件追加の書き込み量が既存件数に比例しない', async () => {
    const { setThumbnail } = await import('@/shared/storage/thumbnails');
    await seed(99);

    const before = local._stats.writtenBytes;
    await setThumbnail(100, fakeDataUrl(100));
    const cost = local._stats.writtenBytes - before;

    // 全件 read-modify-write だと 99 枚分 (~800KB) を書き直してしまう。
    // 1 枚分 (8KB) + index の更新で収まっていることを確認する。
    expect(cost).toBeLessThan(16 * KB);
  });

  it('上限を超えたら古いものから捨てる', async () => {
    const { setThumbnail, getThumbnails, getThumbnailStats } =
      await import('@/shared/storage/thumbnails');
    vi.useFakeTimers();
    try {
      for (let i = 1; i <= 101; i++) {
        vi.setSystemTime(new Date(2026, 0, 1, 0, 0, i));
        await setThumbnail(i, fakeDataUrl(i));
      }
    } finally {
      vi.useRealTimers();
    }

    expect((await getThumbnailStats()).count).toBe(100);
    expect(await getThumbnails([1])).toEqual({});
    expect((await getThumbnails([101]))[101]?.dataUrl).toBe(fakeDataUrl(101));
  });

  it('removeThumbnail は対象のタブだけ消す', async () => {
    const { removeThumbnail, getThumbnails } = await import('@/shared/storage/thumbnails');
    await seed(3);

    await removeThumbnail(2);

    expect(Object.keys(await getThumbnails([1, 2, 3]))).toEqual(['1', '3']);
  });

  it('expireOldThumbnails は TTL 超過分だけ消す', async () => {
    const { setThumbnail, expireOldThumbnails, getThumbnails } =
      await import('@/shared/storage/thumbnails');
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 0, 1));
      await setThumbnail(1, fakeDataUrl(1)); // 8 日前になる
      vi.setSystemTime(new Date(2026, 0, 6));
      await setThumbnail(2, fakeDataUrl(2)); // 3 日前になる
    } finally {
      vi.useRealTimers();
    }

    const removed = await expireOldThumbnails(new Date(2026, 0, 9).getTime());

    expect(removed).toBe(1);
    expect(Object.keys(await getThumbnails([1, 2]))).toEqual(['2']);
  });

  it('pruneThumbnails は既に無いタブのサムネを消す', async () => {
    const { pruneThumbnails, getThumbnails } = await import('@/shared/storage/thumbnails');
    await seed(3);

    await pruneThumbnails(new Set([2]));

    expect(Object.keys(await getThumbnails([1, 2, 3]))).toEqual(['2']);
  });

  it('pruneThumbnails はタブが開いていても index から漏れた孤児キーを回収する', async () => {
    const { pruneThumbnails, getThumbnails } = await import('@/shared/storage/thumbnails');
    await seed(1);
    // 画像だけ書けて index 更新前に SW が停止したケースを模す。tabId 42 の
    // タブ自体は開いたままなので「閉じたタブの掃除」では回収されない。
    // index に載っていない画像は件数上限にも TTL にも掛からないため、
    // ここで回収しないと永久に残る。
    await local.set({ 'thumb:42': { dataUrl: fakeDataUrl(42), capturedAt: Date.now() } });

    await pruneThumbnails(new Set([1, 42]));

    expect(Object.keys(await getThumbnails([1, 42]))).toEqual(['1']);
  });

  it('pruneThumbnails は v1 の単一キー thumbnails を破棄する', async () => {
    const { pruneThumbnails } = await import('@/shared/storage/thumbnails');
    // 旧実装は全サムネを 1 つの巨大な値に詰めていた。移行はせず捨てる
    // (サムネはアクティブ化のたびに撮り直されるキャッシュなので復元不要)。
    await local.set({ thumbnails: { 1: { dataUrl: fakeDataUrl(1), capturedAt: Date.now() } } });

    await pruneThumbnails(new Set([1]));

    expect('thumbnails' in local._data).toBe(false);
  });

  it('getThumbnailStats は画像本体を読まずに件数とバイト数を返す', async () => {
    const { getThumbnailStats } = await import('@/shared/storage/thumbnails');
    await seed(3);

    const before = local._stats.readBytes;
    const stats = await getThumbnailStats();

    expect(stats.count).toBe(3);
    expect(stats.approximateBytes).toBeGreaterThan(3 * 8 * KB);
    // index だけを見れば済むので、画像 3 枚分 (24KB) を読み込む必要はない。
    expect(local._stats.readBytes - before).toBeLessThan(8 * KB);
  });

  it('clearAllThumbnails は画像も index も残さない', async () => {
    const { clearAllThumbnails, getThumbnails, getThumbnailStats } =
      await import('@/shared/storage/thumbnails');
    await seed(3);

    await clearAllThumbnails();

    expect(await getThumbnails([1, 2, 3])).toEqual({});
    expect(await getThumbnailStats()).toEqual({ count: 0, approximateBytes: 0 });
    expect(Object.keys(local._data)).toEqual([]);
  });

  it('並行して撮られたサムネがどちらも失われない', async () => {
    const { setThumbnail, getThumbnails } = await import('@/shared/storage/thumbnails');

    // 別ウィンドウの onActivated が同時に走るケース。index の
    // read-modify-write が競合しても両方残らなければならない。
    await Promise.all([setThumbnail(1, fakeDataUrl(1)), setThumbnail(2, fakeDataUrl(2))]);

    expect(Object.keys(await getThumbnails([1, 2]))).toEqual(['1', '2']);
  });
});
