import { getMruStacks, setMruStacks } from '@/shared/storage/local-state';

export async function bringToFront(windowId: number, tabId: number): Promise<void> {
  const stacks = await getMruStacks();
  const cur = (stacks[windowId] ?? []).filter((id) => id !== tabId);
  cur.unshift(tabId);
  stacks[windowId] = cur;
  await setMruStacks(stacks);
}

export async function removeTab(tabId: number, windowId?: number): Promise<void> {
  const stacks = await getMruStacks();
  if (windowId !== undefined) {
    stacks[windowId] = (stacks[windowId] ?? []).filter((id) => id !== tabId);
  } else {
    for (const wid of Object.keys(stacks)) {
      const k = Number(wid);
      stacks[k] = (stacks[k] ?? []).filter((id) => id !== tabId);
    }
  }
  await setMruStacks(stacks);
}

export async function getMruForWindow(windowId: number): Promise<number[]> {
  const stacks = await getMruStacks();
  return stacks[windowId] ?? [];
}

// opener (= リンクをクリックした現在アクティブタブ) の直後に新タブを挿入する。
// opener が MRU に未登録なら index 1 (先頭の次 = 次の切替先) に挿入する。
// 常に opener 直後へ入れるので、連続オープン時は「最新が先頭寄り」になる。
export async function insertAfterOpener(
  windowId: number,
  tabId: number,
  openerTabId: number,
): Promise<void> {
  const stacks = await getMruStacks();
  const cur = (stacks[windowId] ?? []).filter((id) => id !== tabId);
  const openerIdx = cur.indexOf(openerTabId);
  const insertAt = openerIdx >= 0 ? openerIdx + 1 : 1;
  cur.splice(insertAt, 0, tabId);
  stacks[windowId] = cur;
  await setMruStacks(stacks);
}

export async function cleanupStacksForKnownTabs(knownTabIds: Set<number>): Promise<void> {
  const stacks = await getMruStacks();
  let changed = false;
  for (const wid of Object.keys(stacks)) {
    const k = Number(wid);
    const filtered = (stacks[k] ?? []).filter((id) => knownTabIds.has(id));
    if (filtered.length !== (stacks[k] ?? []).length) {
      stacks[k] = filtered;
      changed = true;
    }
  }
  if (changed) await setMruStacks(stacks);
}
