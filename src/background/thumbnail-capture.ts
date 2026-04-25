import { setThumbnail } from '@/shared/storage/thumbnails';

// captureVisibleTab のレート制限 (~2 回/秒) に合わせて、最後のキャプチャ
// から十分な間隔を空けてから次を撮る。
const MIN_CAPTURE_INTERVAL_MS = 600;
const lastCaptureAtByWindow = new Map<number, number>();

function canCaptureUrl(url: string | undefined): boolean {
  if (!url) return false;
  // Chrome の特殊 URL は protocol prefix で判定 (これらは host 概念がない)
  if (url.startsWith('chrome://')) return false;
  if (url.startsWith('chrome-extension://')) return false;
  if (url.startsWith('devtools://')) return false;
  if (url.startsWith('about:')) return false;
  if (url.startsWith('view-source:')) return false;
  // Web Store はホスト名で厳密判定する。url.startsWith('https://...') 形式だと
  // 'https://chromewebstore.google.com.evil.com' のような host 偽装で bypass
  // できてしまう (CodeQL: js/incomplete-url-substring-sanitization)。
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.hostname === 'chromewebstore.google.com') return false;
  if (parsed.hostname === 'chrome.google.com' && parsed.pathname.startsWith('/webstore')) {
    return false;
  }
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
