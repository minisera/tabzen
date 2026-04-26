import type { ClosedTab, TabMeta } from '@/shared/schema/tab-meta';
import type { Settings } from '@/shared/schema/settings';
import type { DayStat } from '@/shared/schema/daily-stats';
import type { TabSession } from '@/shared/schema/session';

export type TabSwitchItem = TabMeta & { thumbnail?: string };

export interface Stats {
  totalTabs: number;
  /** クローズ閾値を超え、自動クローズ対象になっているタブ数 */
  closeCandidates: number;
  /** 自動管理対象 (除外ルールに該当しないタブ) の総数 */
  managedCount: number;
  /** 既にサスペンド (chrome.tabs.discard) 済みのタブ数 */
  suspendedCount: number;
}

export interface DuplicateGroup {
  normalizedUrl: string;
  tabs: Array<{ tabId: number; title: string; lastActiveAt: number }>;
}

export type RuntimeRequest =
  | { kind: 'getSettings' }
  | { kind: 'setSettings'; settings: Settings }
  | { kind: 'getStats' }
  | { kind: 'closeInactiveNow' }
  | { kind: 'closeDuplicates' }
  | { kind: 'suspendAll' }
  | { kind: 'closeAllInWindow' }
  | { kind: 'findDuplicates' }
  | { kind: 'listHistory' }
  | { kind: 'restoreAt'; index: number }
  | { kind: 'clearHistory' }
  | { kind: 'getMruPreview'; windowId?: number }
  | { kind: 'getAllTabs' }
  | { kind: 'switchToTab'; tabId: number }
  | { kind: 'reportFormDirty'; dirty: boolean }
  | { kind: 'getThumbnailStats' }
  | { kind: 'clearThumbnails' }
  | { kind: 'getDailyStats' }
  | { kind: 'clearDailyStats' }
  | { kind: 'saveSession'; name: string; scope: 'currentWindow' | 'allWindows' }
  | { kind: 'listSessions' }
  | { kind: 'openSession'; id: string; mode: 'newWindow' | 'currentWindow' }
  | { kind: 'deleteSession'; id: string }
  | { kind: 'renameSession'; id: string; name: string };

export type RuntimeResponse<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

/** Service Worker → Content Script へのメッセージ */
export type ContentRequest =
  | { kind: 'confirm'; message: string }
  | {
      kind: 'tabSwitchCycle';
      direction: 'next' | 'prev';
      items: TabSwitchItem[];
    }
  | {
      kind: 'openSearchPalette';
      items: TabSwitchItem[];
    };

export interface ContentConfirmResponse {
  ok: boolean;
}

export type RuntimeResponseMap = {
  getSettings: Settings;
  setSettings: void;
  getStats: Stats;
  closeInactiveNow: { closed: number };
  closeDuplicates: { closed: number };
  suspendAll: { suspended: number };
  closeAllInWindow: { closed: number };
  findDuplicates: DuplicateGroup[];
  listHistory: ClosedTab[];
  restoreAt: void;
  clearHistory: void;
  getMruPreview: TabSwitchItem[];
  getAllTabs: TabSwitchItem[];
  switchToTab: void;
  reportFormDirty: void;
  getThumbnailStats: { count: number; approximateBytes: number };
  clearThumbnails: void;
  getDailyStats: DayStat[];
  clearDailyStats: void;
  saveSession: TabSession;
  listSessions: TabSession[];
  openSession: { opened: number };
  deleteSession: void;
  renameSession: void;
};
