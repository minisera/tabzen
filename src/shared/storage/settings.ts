import { defaultSettings, settingsSchema, type Settings } from '@/shared/schema/settings';

const KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const raw = await chrome.storage.sync.get(KEY);
  const parsed = settingsSchema.safeParse(raw[KEY]);
  return parsed.success ? parsed.data : defaultSettings;
}

export async function setSettings(next: Settings): Promise<void> {
  const parsed = settingsSchema.parse(next);
  await chrome.storage.sync.set({ [KEY]: parsed });
}

export function onSettingsChange(cb: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'sync') return;
    const c = changes[KEY];
    if (!c) return;
    const parsed = settingsSchema.safeParse(c.newValue);
    if (parsed.success) cb(parsed.data);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
