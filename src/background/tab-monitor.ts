import type { TabMeta } from '@/shared/schema/tab-meta';
import { getTabMeta, setTabMeta } from '@/shared/storage/local-state';
import { pruneThumbnails, removeThumbnail } from '@/shared/storage/thumbnails';
import { bringToFront, cleanupStacksForKnownTabs, removeTab as removeFromMru } from './mru-stack';
import { captureActiveTabThumbnail } from './thumbnail-capture';

function toMeta(tab: chrome.tabs.Tab, prev: TabMeta | undefined, now: number): TabMeta | null {
  if (tab.id === undefined || tab.windowId === undefined) return null;
  return {
    tabId: tab.id,
    windowId: tab.windowId,
    url: tab.url ?? prev?.url ?? '',
    title: tab.title ?? prev?.title ?? '',
    favIconUrl: tab.favIconUrl ?? prev?.favIconUrl,
    lastActiveAt: prev?.lastActiveAt ?? now,
    pinned: tab.pinned,
    audible: tab.audible ?? false,
    groupId: tab.groupId !== undefined && tab.groupId !== -1 ? tab.groupId : undefined,
    formDirty: prev?.formDirty ?? false,
    suspended: tab.discarded ?? prev?.suspended ?? false,
  };
}

async function upsertMeta(tab: chrome.tabs.Tab): Promise<void> {
  const map = await getTabMeta();
  const next = toMeta(tab, tab.id !== undefined ? map[tab.id] : undefined, Date.now());
  if (!next) return;
  map[next.tabId] = next;
  await setTabMeta(map);
}

async function touchActive(tabId: number, windowId: number): Promise<void> {
  const map = await getTabMeta();
  const m = map[tabId];
  if (m) {
    m.lastActiveAt = Date.now();
    m.windowId = windowId;
    m.suspended = false;
    map[tabId] = m;
    await setTabMeta(map);
  }
  await bringToFront(windowId, tabId);
}

export function initTabMonitor(): void {
  chrome.tabs.onCreated.addListener((tab) => void upsertMeta(tab));

  chrome.tabs.onUpdated.addListener((_tabId, _info, tab) => {
    void upsertMeta(tab);
  });

  chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
    try {
      const tab = await chrome.tabs.get(tabId);
      await upsertMeta(tab);
    } catch {
      // タブが既に閉じられていた
    }
    await touchActive(tabId, windowId);
    // アクティブ化直後にページ描画が落ち着く時間を少し置いてスクショを撮る。
    // 非同期で握りつぶすので touchActive を待たせない。
    setTimeout(() => {
      void captureActiveTabThumbnail(tabId, windowId);
    }, 250);
  });

  chrome.tabs.onRemoved.addListener(async (tabId, info) => {
    await removeFromMru(tabId, info.windowId);
    const map = await getTabMeta();
    delete map[tabId];
    await setTabMeta(map);
    await removeThumbnail(tabId);
  });

  chrome.tabs.onReplaced.addListener(async (addedTabId, removedTabId) => {
    await removeFromMru(removedTabId);
    try {
      const tab = await chrome.tabs.get(addedTabId);
      await upsertMeta(tab);
    } catch {
      // no-op
    }
  });
}

export async function bootstrapCurrentTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const map = await getTabMeta();
  const now = Date.now();
  const knownIds = new Set<number>();

  for (const tab of tabs) {
    if (tab.id === undefined || tab.windowId === undefined) continue;
    knownIds.add(tab.id);
    const existing = map[tab.id];
    const next = toMeta(tab, existing, now);
    if (next) {
      map[tab.id] = next;
      if (tab.active) await bringToFront(tab.windowId, tab.id);
    }
  }

  // 既に存在しない tabId のメタを削除
  for (const idStr of Object.keys(map)) {
    const id = Number(idStr);
    if (!knownIds.has(id)) delete map[id];
  }

  await setTabMeta(map);
  await cleanupStacksForKnownTabs(knownIds);
  await pruneThumbnails(knownIds);
}
