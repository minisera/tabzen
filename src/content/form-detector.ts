import type { RuntimeRequest } from '@/shared/types';

export function initFormDetector(): void {
  let dirty = false;

  const setDirty = (d: boolean) => {
    if (d === dirty) return;
    dirty = d;
    const msg: RuntimeRequest = { kind: 'reportFormDirty', dirty: d };
    chrome.runtime.sendMessage(msg).catch(() => {
      // SW が寝ているケースなど
    });
  };

  const onInput = (e: Event) => {
    const el = e.target as HTMLElement | null;
    if (!el) return;
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      if (el.type === 'hidden') return;
      setDirty(true);
      return;
    }
    if (el.isContentEditable) {
      setDirty(true);
    }
  };

  document.addEventListener('input', onInput, true);
  document.addEventListener('submit', () => setDirty(false), true);
  window.addEventListener('beforeunload', () => setDirty(false));
}
