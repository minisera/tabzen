import type { RuntimeRequest } from '@/shared/types';

export function initFormDetector(): void {
  let dirty = false;

  const setDirty = (d: boolean) => {
    if (d === dirty) return;
    dirty = d;
    // 拡張リロード後に残った古い content script から呼ばれると
    // sendMessage は同期 throw する ("Extension context invalidated.")。
    // chrome.runtime.id 不在でガードしてから try/catch で握りつぶす。
    if (!chrome.runtime?.id) return;
    const msg: RuntimeRequest = { kind: 'reportFormDirty', dirty: d };
    try {
      chrome.runtime.sendMessage(msg).catch(() => {
        // SW が寝ている / context invalidated 等は無視
      });
    } catch {
      // 同期 throw も無視
    }
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
