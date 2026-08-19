// サムネイルは tabId ごとに独立したキー (`thumb:<tabId>`) に保存する。
// v1 は全件を単一キー `thumbnails` に詰めていたため、1 枚撮るたび・1 枚
// 読むたびに全件 (実測 8MB) の read-modify-write が発生し、Ctrl+Q の
// オーバーレイ表示と拡張全体を遅くしていた (8 日間で 8.5GB の書き込み)。
//
// 件数上限・TTL・容量表示のために capturedAt と size だけを持つ軽量な
// index を別キーに置く。index はあくまで補助情報で、読み出し
// (getThumbnails) は index を参照せず実キーだけを見る。SW はキー削除と
// index 更新の間で停止しうるので index のズレは避けられないが、読み出しが
// 実キー基準ならズレても表示は壊れない。
const PREFIX = 'thumb:';
const INDEX_KEY = 'thumbIndex';
const LEGACY_KEY = 'thumbnails';
const MAX_THUMBNAILS = 100;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 日

export interface ThumbnailRecord {
  dataUrl: string;
  capturedAt: number;
}

export interface ThumbnailStats {
  count: number;
  approximateBytes: number;
}

interface IndexEntry {
  capturedAt: number;
  size: number;
}

type ThumbnailIndex = Record<number, IndexEntry>;

function keyOf(tabId: number): string {
  return `${PREFIX}${tabId}`;
}

/** `thumb:123` → 123。サムネイル以外のキーなら null。 */
function tabIdOf(key: string): number | null {
  if (!key.startsWith(PREFIX)) return null;
  const id = Number(key.slice(PREFIX.length));
  return Number.isInteger(id) ? id : null;
}

async function getIndex(): Promise<ThumbnailIndex> {
  const r = await chrome.storage.local.get(INDEX_KEY);
  return (r[INDEX_KEY] as ThumbnailIndex) ?? {};
}

async function setIndex(index: ThumbnailIndex): Promise<void> {
  await chrome.storage.local.set({ [INDEX_KEY]: index });
}

// index の read-modify-write を直列化する。複数ウィンドウの onActivated が
// 同時に走ると index の更新が互いを上書きし、実キーはあるのに index に
// 載っていないサムネ (= どの維持処理からも見えず消えない孤児) が生まれる。
// SW 生存中の競合はこのキューで防ぎ、SW 再起動を跨いで生じた孤児は
// pruneThumbnails が実キー列挙で回収する。
let tail: Promise<unknown> = Promise.resolve();
function withIndexLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.catch(() => undefined);
  return run;
}

/** 指定した tabId のサムネイルだけを読み出す (存在しないものは黙って除外)。 */
export async function getThumbnails(tabIds: number[]): Promise<Record<number, ThumbnailRecord>> {
  if (tabIds.length === 0) return {};
  const r = await chrome.storage.local.get(tabIds.map(keyOf));
  const out: Record<number, ThumbnailRecord> = {};
  for (const tabId of tabIds) {
    const rec = r[keyOf(tabId)] as ThumbnailRecord | undefined;
    if (rec) out[tabId] = rec;
  }
  return out;
}

export async function setThumbnail(tabId: number, dataUrl: string): Promise<void> {
  // 画像の書き込みも lock の内側で行う。外に出すと pruneThumbnails が
  // 画像書き込みと index 更新の隙間に割り込み、まだ index に載っていない
  // 撮りたてのサムネを孤児と誤認して消してしまう。
  await withIndexLock(async () => {
    const capturedAt = Date.now();
    await chrome.storage.local.set({ [keyOf(tabId)]: { dataUrl, capturedAt } });

    const index = await getIndex();
    index[tabId] = { capturedAt, size: dataUrl.length };

    const ids = Object.keys(index).map(Number);
    if (ids.length > MAX_THUMBNAILS) {
      const evict = ids
        .sort((a, b) => (index[b]?.capturedAt ?? 0) - (index[a]?.capturedAt ?? 0))
        .slice(MAX_THUMBNAILS);
      // 実体 → index の順に消す。逆順だと index から消えた直後に SW が
      // 停止した場合、誰からも参照されない画像が storage に残り続ける。
      await chrome.storage.local.remove(evict.map(keyOf));
      for (const id of evict) delete index[id];
    }
    await setIndex(index);
  });
}

export async function removeThumbnail(tabId: number): Promise<void> {
  await chrome.storage.local.remove(keyOf(tabId));
  await withIndexLock(async () => {
    const index = await getIndex();
    if (!(tabId in index)) return;
    delete index[tabId];
    await setIndex(index);
  });
}

/** 既に存在しないタブのサムネイルを回収する (SW 起動時に呼ぶ)。 */
export async function pruneThumbnails(knownTabIds: Set<number>): Promise<void> {
  await withIndexLock(async () => {
    const keys = await chrome.storage.local.getKeys();
    const index = await getIndex();
    const stale: string[] = [];
    for (const key of keys) {
      const tabId = tabIdOf(key);
      if (tabId === null) continue;
      // 閉じたタブの画像に加えて、index に載っていない画像も捨てる。
      // 後者は画像書き込みと index 更新の間で SW が停止したときの
      // 取り残しで、件数上限にも TTL にも掛からないため放置すると
      // 永久に残り続ける (v1 の肥大化を別の形で再現してしまう)。
      if (!knownTabIds.has(tabId) || !(tabId in index)) stale.push(key);
    }
    // v1 の単一キーは移行せず捨てる。サムネイルはタブをアクティブに
    // するたび撮り直されるキャッシュなので、引き継ぐ価値より数 MB を
    // 抱え続けるコストの方が大きい。
    if (keys.includes(LEGACY_KEY)) stale.push(LEGACY_KEY);
    if (stale.length > 0) await chrome.storage.local.remove(stale);

    let changed = false;
    for (const idStr of Object.keys(index)) {
      const id = Number(idStr);
      if (knownTabIds.has(id)) continue;
      delete index[id];
      changed = true;
    }
    if (changed) await setIndex(index);
  });
}

/** capturedAt が MAX_AGE_MS より古い thumbnail を削除する (alarm から呼ぶ) */
export async function expireOldThumbnails(now: number = Date.now()): Promise<number> {
  return withIndexLock(async () => {
    const index = await getIndex();
    const expired = Object.keys(index)
      .map(Number)
      .filter((id) => now - (index[id]?.capturedAt ?? 0) > MAX_AGE_MS);
    if (expired.length === 0) return 0;

    await chrome.storage.local.remove(expired.map(keyOf));
    for (const id of expired) delete index[id];
    await setIndex(index);
    return expired.length;
  });
}

/** 全ての thumbnail を削除する (手動クリア用) */
export async function clearAllThumbnails(): Promise<void> {
  await withIndexLock(async () => {
    const keys = await chrome.storage.local.getKeys();
    const targets = keys.filter((k) => tabIdOf(k) !== null || k === INDEX_KEY || k === LEGACY_KEY);
    if (targets.length > 0) await chrome.storage.local.remove(targets);
  });
}

/** キャッシュの件数と概算バイト数を返す (UI 表示用)。画像本体は読まない。 */
export async function getThumbnailStats(): Promise<ThumbnailStats> {
  const index = await getIndex();
  let bytes = 0;
  let count = 0;
  for (const idStr of Object.keys(index)) {
    const entry = index[Number(idStr)];
    if (!entry) continue;
    count++;
    // data URL は base64 なので文字列長がほぼバイト数に対応
    bytes += entry.size;
  }
  return { count, approximateBytes: bytes };
}
