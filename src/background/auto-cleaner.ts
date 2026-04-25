import type { ClosedTab, TabMeta } from '@/shared/schema/tab-meta';
import type { Settings } from '@/shared/schema/settings';
import {
  getRestoreHistory,
  getTabMeta,
  setRestoreHistory,
  setTabMeta,
} from '@/shared/storage/local-state';
import { findDomainRule, isAllowlisted } from '@/shared/utils/url-normalize';
import { recordDailyStat } from '@/shared/storage/daily-stats';

export type ExclusionReason =
  | 'pinned'
  | 'audible'
  | 'active'
  | 'formDirty'
  | 'allowlisted'
  | 'domainRule'
  | 'none';

export function exclusionReason(
  meta: TabMeta,
  settings: Settings,
  activeTabIds: Set<number>,
): ExclusionReason {
  if (meta.pinned) return 'pinned';
  if (meta.audible) return 'audible';
  if (meta.formDirty) return 'formDirty';
  if (activeTabIds.has(meta.tabId)) return 'active';
  if (isAllowlisted(meta.url, settings.allowlist)) return 'allowlisted';
  const rule = findDomainRule(meta.url, settings.domainRules);
  if (rule?.mode === 'neverClose') return 'domainRule';
  return 'none';
}

/**
 * このタブに適用する閾値を返す。custom ルールにマッチした場合はそちらを
 * 優先し、なければグローバル設定を使う。
 */
export function thresholdsForTab(
  meta: TabMeta,
  settings: Settings,
): { suspendMs: number; closeMs: number } {
  const rule = findDomainRule(meta.url, settings.domainRules);
  if (
    rule?.mode === 'custom' &&
    rule.suspendAfterMinutes !== undefined &&
    rule.closeAfterMinutes !== undefined
  ) {
    return {
      suspendMs: rule.suspendAfterMinutes * 60_000,
      closeMs: rule.closeAfterMinutes * 60_000,
    };
  }
  return {
    suspendMs: settings.suspendAfterMinutes * 60_000,
    closeMs: settings.closeAfterMinutes * 60_000,
  };
}

/** クローズ閾値を超えていて除外ルールに該当しないタブを返す。 */
export function selectCloseTargets(
  metas: TabMeta[],
  settings: Settings,
  activeTabIds: Set<number>,
  now: number,
): TabMeta[] {
  return metas.filter((m) => {
    if (exclusionReason(m, settings, activeTabIds) !== 'none') return false;
    const { closeMs } = thresholdsForTab(m, settings);
    return now - m.lastActiveAt >= closeMs;
  });
}

export async function getActiveTabIds(): Promise<Set<number>> {
  const tabs = await chrome.tabs.query({ active: true });
  const ids = new Set<number>();
  for (const t of tabs) {
    if (typeof t.id === 'number') ids.add(t.id);
  }
  return ids;
}

function toClosedTab(meta: TabMeta, closedAt: number): ClosedTab {
  return {
    title: meta.title,
    url: meta.url,
    favIconUrl: meta.favIconUrl,
    closedAt,
    groupId: meta.groupId,
  };
}

async function pushRestoreHistory(items: ClosedTab[], limit: number): Promise<void> {
  if (items.length === 0) return;
  const hist = await getRestoreHistory();
  const next = [...items, ...hist].slice(0, limit);
  await setRestoreHistory(next);
}

async function removeTabs(tabIds: number[]): Promise<number> {
  let n = 0;
  for (const id of tabIds) {
    try {
      await chrome.tabs.remove(id);
      n++;
    } catch {
      // already closed
    }
  }
  return n;
}

export async function runAutoClean(
  settings: Settings,
): Promise<{ suspended: number; closed: number }> {
  if (!settings.enabled) return { suspended: 0, closed: 0 };

  const map = await getTabMeta();
  const activeIds = await getActiveTabIds();
  const now = Date.now();

  const toSuspend: TabMeta[] = [];
  const toClose: TabMeta[] = [];

  for (const meta of Object.values(map)) {
    if (exclusionReason(meta, settings, activeIds) !== 'none') continue;
    const idleMs = now - meta.lastActiveAt;
    const { suspendMs, closeMs } = thresholdsForTab(meta, settings);
    if (idleMs >= closeMs) {
      toClose.push(meta);
    } else if (!meta.suspended && idleMs >= suspendMs) {
      toSuspend.push(meta);
    }
  }

  if (toClose.length > 0) {
    await pushRestoreHistory(
      toClose.map((m) => toClosedTab(m, now)),
      settings.restoreHistoryLimit,
    );
    const closed = await removeTabs(toClose.map((m) => m.tabId));
    for (const m of toClose) delete map[m.tabId];
    await recordDailyStat('autoClosed', closed);
  }

  let suspendedCount = 0;
  for (const m of toSuspend) {
    try {
      await chrome.tabs.discard(m.tabId);
      m.suspended = true;
      map[m.tabId] = m;
      suspendedCount++;
    } catch {
      // active tab や discard 不可
    }
  }
  if (suspendedCount > 0) await recordDailyStat('suspended', suspendedCount);

  await setTabMeta(map);
  return { suspended: suspendedCount, closed: toClose.length };
}

export async function closeInactiveNow(settings: Settings): Promise<number> {
  const map = await getTabMeta();
  const activeIds = await getActiveTabIds();
  const now = Date.now();
  const targets = selectCloseTargets(Object.values(map), settings, activeIds, now);
  if (targets.length === 0) return 0;
  await pushRestoreHistory(
    targets.map((m) => toClosedTab(m, now)),
    settings.restoreHistoryLimit,
  );
  const closed = await removeTabs(targets.map((m) => m.tabId));
  for (const m of targets) delete map[m.tabId];
  await setTabMeta(map);
  await recordDailyStat('manualClosed', closed);
  return targets.length;
}

export async function suspendAll(settings: Settings): Promise<number> {
  const map = await getTabMeta();
  const activeIds = await getActiveTabIds();
  let count = 0;
  for (const m of Object.values(map)) {
    if (exclusionReason(m, settings, activeIds) !== 'none') continue;
    if (m.suspended) continue;
    try {
      await chrome.tabs.discard(m.tabId);
      m.suspended = true;
      map[m.tabId] = m;
      count++;
    } catch {
      // ignore
    }
  }
  if (count > 0) {
    await setTabMeta(map);
    await recordDailyStat('suspended', count);
  }
  return count;
}

export async function closeAllInWindow(windowId: number, settings: Settings): Promise<number> {
  const map = await getTabMeta();
  const activeIds = await getActiveTabIds();
  const targets = Object.values(map).filter(
    (m) => m.windowId === windowId && exclusionReason(m, settings, activeIds) === 'none',
  );
  if (targets.length === 0) return 0;
  const now = Date.now();
  await pushRestoreHistory(
    targets.map((m) => toClosedTab(m, now)),
    settings.restoreHistoryLimit,
  );
  const closed = await removeTabs(targets.map((m) => m.tabId));
  for (const m of targets) delete map[m.tabId];
  await setTabMeta(map);
  await recordDailyStat('manualClosed', closed);
  return targets.length;
}
