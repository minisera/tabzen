const KEY = 'thumbnails';
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

export async function getThumbnails(): Promise<Record<number, ThumbnailRecord>> {
  const r = await chrome.storage.local.get(KEY);
  return (r[KEY] as Record<number, ThumbnailRecord>) ?? {};
}

export async function setThumbnail(tabId: number, dataUrl: string): Promise<void> {
  const all = await getThumbnails();
  all[tabId] = { dataUrl, capturedAt: Date.now() };
  const keys = Object.keys(all);
  if (keys.length > MAX_THUMBNAILS) {
    // 古い順に削除して上限を維持
    const sorted = keys
      .map((k) => [Number(k), all[Number(k)]] as const)
      .sort((a, b) => b[1].capturedAt - a[1].capturedAt);
    const kept = Object.fromEntries(sorted.slice(0, MAX_THUMBNAILS));
    await chrome.storage.local.set({ [KEY]: kept });
    return;
  }
  await chrome.storage.local.set({ [KEY]: all });
}

export async function removeThumbnail(tabId: number): Promise<void> {
  const all = await getThumbnails();
  if (tabId in all) {
    delete all[tabId];
    await chrome.storage.local.set({ [KEY]: all });
  }
}

export async function pruneThumbnails(knownTabIds: Set<number>): Promise<void> {
  const all = await getThumbnails();
  let changed = false;
  for (const idStr of Object.keys(all)) {
    const id = Number(idStr);
    if (!knownTabIds.has(id)) {
      delete all[id];
      changed = true;
    }
  }
  if (changed) await chrome.storage.local.set({ [KEY]: all });
}

/** capturedAt が MAX_AGE_MS より古い thumbnail を削除する (alarm から呼ぶ) */
export async function expireOldThumbnails(now: number = Date.now()): Promise<number> {
  const all = await getThumbnails();
  let removed = 0;
  for (const idStr of Object.keys(all)) {
    const id = Number(idStr);
    const rec = all[id];
    if (!rec) continue;
    if (now - rec.capturedAt > MAX_AGE_MS) {
      delete all[id];
      removed++;
    }
  }
  if (removed > 0) await chrome.storage.local.set({ [KEY]: all });
  return removed;
}

/** 全ての thumbnail を削除する (手動クリア用) */
export async function clearAllThumbnails(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}

/** キャッシュの件数と概算バイト数を返す (UI 表示用) */
export async function getThumbnailStats(): Promise<ThumbnailStats> {
  const all = await getThumbnails();
  let bytes = 0;
  let count = 0;
  for (const idStr of Object.keys(all)) {
    const rec = all[Number(idStr)];
    if (!rec) continue;
    count++;
    // data URL は base64 なので文字列長がほぼバイト数に対応
    bytes += rec.dataUrl.length;
  }
  return { count, approximateBytes: bytes };
}
