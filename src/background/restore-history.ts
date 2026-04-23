import { getRestoreHistory, setRestoreHistory } from '@/shared/storage/local-state';
import type { ClosedTab } from '@/shared/schema/tab-meta';

export async function listHistory(): Promise<ClosedTab[]> {
  return getRestoreHistory();
}

export async function restoreAt(index: number): Promise<void> {
  const hist = await getRestoreHistory();
  const item = hist[index];
  if (!item) return;
  await chrome.tabs.create({ url: item.url, active: false });
  const next = [...hist.slice(0, index), ...hist.slice(index + 1)];
  await setRestoreHistory(next);
}

export async function clearHistory(): Promise<void> {
  await setRestoreHistory([]);
}
