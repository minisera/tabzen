import type { Settings } from '@/shared/schema/settings';
import { getTabMeta, setTabMeta } from '@/shared/storage/local-state';
import { normalizeUrl } from '@/shared/utils/url-normalize';
import type { DuplicateGroup } from '@/shared/types';

export async function findDuplicates(settings: Settings): Promise<DuplicateGroup[]> {
  const map = await getTabMeta();
  const groups = new Map<string, DuplicateGroup>();
  for (const meta of Object.values(map)) {
    if (!meta.url) continue;
    const key = normalizeUrl(meta.url, settings.normalizeUrl);
    const g = groups.get(key) ?? { normalizedUrl: key, tabs: [] };
    g.tabs.push({
      tabId: meta.tabId,
      title: meta.title,
      lastActiveAt: meta.lastActiveAt,
    });
    groups.set(key, g);
  }
  return Array.from(groups.values()).filter((g) => g.tabs.length > 1);
}

export async function closeDuplicates(settings: Settings): Promise<number> {
  const dups = await findDuplicates(settings);
  if (dups.length === 0) return 0;
  const map = await getTabMeta();
  let closed = 0;
  for (const g of dups) {
    const sorted = [...g.tabs].sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    for (let i = 1; i < sorted.length; i++) {
      const id = sorted[i].tabId;
      try {
        await chrome.tabs.remove(id);
        delete map[id];
        closed++;
      } catch {
        // ignore
      }
    }
  }
  if (closed > 0) await setTabMeta(map);
  return closed;
}
