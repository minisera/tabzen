import { z } from 'zod';
import { tabSessionSchema, type TabSession } from '@/shared/schema/session';

const KEY = 'tabSessions';
const arraySchema = z.array(tabSessionSchema);

export async function getSessions(): Promise<TabSession[]> {
  const r = await chrome.storage.local.get(KEY);
  const parsed = arraySchema.safeParse(r[KEY]);
  return parsed.success ? parsed.data : [];
}

export async function setSessions(items: TabSession[]): Promise<void> {
  await chrome.storage.local.set({ [KEY]: items });
}
