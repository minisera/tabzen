import { snoozedTabSchema, type SnoozedTab } from '@/shared/schema/snooze';
import { z } from 'zod';

const KEY = 'snoozedTabs';

const arraySchema = z.array(snoozedTabSchema);

export async function getSnoozedTabs(): Promise<SnoozedTab[]> {
  const r = await chrome.storage.local.get(KEY);
  const parsed = arraySchema.safeParse(r[KEY]);
  return parsed.success ? parsed.data : [];
}

export async function setSnoozedTabs(items: SnoozedTab[]): Promise<void> {
  await chrome.storage.local.set({ [KEY]: items });
}
