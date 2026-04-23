import { setThumbnail } from '@/shared/storage/thumbnails';

// captureVisibleTab のレート制限 (~2 回/秒) に合わせて、最後のキャプチャ
// から十分な間隔を空けてから次を撮る。
const MIN_CAPTURE_INTERVAL_MS = 600;
const lastCaptureAtByWindow = new Map<number, number>();

function canCaptureUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (url.startsWith('chrome://')) return false;
  if (url.startsWith('chrome-extension://')) return false;
  if (url.startsWith('devtools://')) return false;
  if (url.startsWith('about:')) return false;
  if (url.startsWith('view-source:')) return false;
  if (url.startsWith('https://chrome.google.com/webstore')) return false;
  if (url.startsWith('https://chromewebstore.google.com')) return false;
  return true;
}

export async function captureActiveTabThumbnail(tabId: number, windowId: number): Promise<void> {
  const now = Date.now();
  const lastCaptureAt = lastCaptureAtByWindow.get(windowId) ?? 0;
  if (now - lastCaptureAt < MIN_CAPTURE_INTERVAL_MS) return;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active || tab.windowId !== windowId || tab.discarded) return;
    if (!canCaptureUrl(tab.url)) return;

    lastCaptureAtByWindow.set(windowId, now);
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: 'jpeg',
      quality: 40,
    });
    if (dataUrl) {
      await setThumbnail(tabId, dataUrl);
    }
  } catch {
    // capture 不可 (chrome:// / 権限不足 / rate limit) は握りつぶす
  }
}
