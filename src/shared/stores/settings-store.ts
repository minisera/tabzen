import { create } from 'zustand';
import { defaultSettings, settingsSchema, type Settings } from '@/shared/schema/settings';
import { sendMessage } from '@/shared/lib/runtime-client';

interface SettingsState {
  settings: Settings;
  draft: Settings;
  loading: boolean;
  saving: boolean;
  error: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  setDraft: (patch: Partial<Settings>) => void;
  save: () => Promise<void>;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  draft: defaultSettings,
  loading: true,
  saving: false,
  error: null,
  loaded: false,
  load: async () => {
    try {
      const s = await sendMessage({ kind: 'getSettings' });
      set({ settings: s, draft: s, loading: false, loaded: true, error: null });
    } catch (e) {
      set({ loading: false, loaded: true, error: e instanceof Error ? e.message : String(e) });
    }
  },
  setDraft: (patch) => {
    set({ draft: { ...get().draft, ...patch }, error: null });
  },
  save: async () => {
    const { draft } = get();
    const parsed = settingsSchema.safeParse(draft);
    if (!parsed.success) {
      set({ error: parsed.error.issues.map((i) => i.message).join(' / ') });
      return;
    }
    set({ saving: true, error: null });
    try {
      await sendMessage({ kind: 'setSettings', settings: parsed.data });
      set({ settings: parsed.data, draft: parsed.data, saving: false });
    } catch (e) {
      set({ saving: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
  reset: () => {
    set({ draft: get().settings, error: null });
  },
}));
