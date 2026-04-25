import type { SessionItem, TabSession } from '@/shared/schema/session';
import { getSessions, setSessions } from '@/shared/storage/sessions';

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isCapturable(url: string | undefined): boolean {
  if (!url) return false;
  // chrome:// や chrome-extension:// は再オープン不可、空 URL も無視
  return /^(https?|file|ftp|view-source):/.test(url);
}

function tabToItem(tab: chrome.tabs.Tab): SessionItem | null {
  if (!isCapturable(tab.url)) return null;
  return {
    url: tab.url!,
    title: tab.title ?? tab.url!,
    favIconUrl: tab.favIconUrl,
    pinned: !!tab.pinned,
  };
}

export interface SaveSessionOptions {
  name: string;
  scope: 'currentWindow' | 'allWindows';
  windowId?: number;
}

export async function saveSession(opts: SaveSessionOptions): Promise<TabSession> {
  const queryOpts: chrome.tabs.QueryInfo =
    opts.scope === 'currentWindow'
      ? { windowId: opts.windowId ?? chrome.windows.WINDOW_ID_CURRENT }
      : {};
  const tabs = await chrome.tabs.query(queryOpts);
  const items = tabs.map((t) => tabToItem(t)).filter((v): v is SessionItem => v !== null);
  const session: TabSession = {
    id: uuid(),
    name: opts.name.trim() || `Session ${new Date().toLocaleString()}`,
    createdAt: Date.now(),
    items,
  };
  const list = await getSessions();
  await setSessions([session, ...list]);
  return session;
}

export async function listSessions(): Promise<TabSession[]> {
  return getSessions();
}

export async function deleteSession(id: string): Promise<void> {
  const list = await getSessions();
  await setSessions(list.filter((s) => s.id !== id));
}

export async function renameSession(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const list = await getSessions();
  await setSessions(list.map((s) => (s.id === id ? { ...s, name: trimmed } : s)));
}

export interface OpenSessionOptions {
  id: string;
  mode: 'newWindow' | 'currentWindow';
}

export async function openSession(opts: OpenSessionOptions): Promise<{ opened: number }> {
  const list = await getSessions();
  const session = list.find((s) => s.id === opts.id);
  if (!session) throw new Error('セッションが見つかりません');
  if (session.items.length === 0) return { opened: 0 };

  if (opts.mode === 'newWindow') {
    // 1 つ目のタブで新規ウィンドウを開き、残りを順に追加。
    // chrome.windows.create の url 配列はピン留め情報を持たないため、
    // 1 件ずつ tabs.create で復元する。
    const [first, ...rest] = session.items;
    const win = await chrome.windows.create({ url: first.url, focused: true });
    if (typeof win?.id !== 'number') return { opened: 1 };
    if (first.pinned) {
      const [createdFirst] = await chrome.tabs.query({ windowId: win.id });
      if (typeof createdFirst?.id === 'number') {
        await chrome.tabs.update(createdFirst.id, { pinned: true });
      }
    }
    for (const item of rest) {
      const tab = await chrome.tabs.create({ windowId: win.id, url: item.url, active: false });
      if (item.pinned && typeof tab.id === 'number') {
        await chrome.tabs.update(tab.id, { pinned: true });
      }
    }
    return { opened: session.items.length };
  }

  // currentWindow: 現在のウィンドウに append
  const win = await chrome.windows.getCurrent();
  for (const item of session.items) {
    const tab = await chrome.tabs.create({ windowId: win.id, url: item.url, active: false });
    if (item.pinned && typeof tab.id === 'number') {
      await chrome.tabs.update(tab.id, { pinned: true });
    }
  }
  return { opened: session.items.length };
}
