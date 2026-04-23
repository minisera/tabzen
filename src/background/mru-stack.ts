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
