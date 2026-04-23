import type { ClosedTab, TabMeta } from '@/shared/schema/tab-meta';

const KEYS = {
  tabMeta: 'tabMeta',
  mruStacks: 'mruStacks',
  restoreHistory: 'restoreHistory',
} as const;

export async function getTabMeta(): Promise<Record<number, TabMeta>> {
  const r = await chrome.storage.local.get(KEYS.tabMeta);
  return (r[KEYS.tabMeta] as Record<number, TabMeta>) ?? {};
}
export async function setTabMeta(map: Record<number, TabMeta>): Promise<void> {
  await chrome.storage.local.set({ [KEYS.tabMeta]: map });
}

export async function getMruStacks(): Promise<Record<number, number[]>> {
  const r = await chrome.storage.local.get(KEYS.mruStacks);
  return (r[KEYS.mruStacks] as Record<number, number[]>) ?? {};
}
export async function setMruStacks(stacks: Record<number, number[]>): Promise<void> {
  await chrome.storage.local.set({ [KEYS.mruStacks]: stacks });
}

export async function getRestoreHistory(): Promise<ClosedTab[]> {
  const r = await chrome.storage.local.get(KEYS.restoreHistory);
  return (r[KEYS.restoreHistory] as ClosedTab[]) ?? [];
}
export async function setRestoreHistory(history: ClosedTab[]): Promise<void> {
  await chrome.storage.local.set({ [KEYS.restoreHistory]: history });
}
