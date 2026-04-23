import type { ClosedTab, TabMeta } from '@/shared/schema/tab-meta';
import type { Settings } from '@/shared/schema/settings';

export interface Stats {
  totalTabs: number;
  inactiveCandidates: number;
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
  | { kind: 'switchToTab'; tabId: number }
  | { kind: 'reportFormDirty'; dirty: boolean };

export type RuntimeResponse<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

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
  getMruPreview: TabMeta[];
  switchToTab: void;
  reportFormDirty: void;
};
