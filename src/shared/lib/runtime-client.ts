import type { RuntimeRequest, RuntimeResponse, RuntimeResponseMap } from '@/shared/types';

export async function sendMessage<K extends RuntimeRequest['kind']>(
  req: Extract<RuntimeRequest, { kind: K }>,
): Promise<RuntimeResponseMap[K]> {
  const res = (await chrome.runtime.sendMessage(req)) as
    | RuntimeResponse<RuntimeResponseMap[K]>
    | undefined;
  if (!res) {
    throw new Error('no response from service worker');
  }
  if (!res.ok) {
    throw new Error(res.error);
  }
  return res.data as RuntimeResponseMap[K];
}

// Content Script から fire-and-forget でメッセージを投げるためのヘルパー。
// 拡張をリロードした直後 (古い CS が残っている状態) の sendMessage は
// "Extension context invalidated" を投げるが、ユーザー操作に影響しない
// ため握りつぶす。それ以外のエラーは warn ログに残す。
export function sendMessageVoid<K extends RuntimeRequest['kind']>(
  req: Extract<RuntimeRequest, { kind: K }>,
): void {
  if (!chrome.runtime?.id) return;
  void sendMessage(req).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Extension context invalidated')) return;
    console.warn('[Tab Tidy] sendMessage failed:', err);
  });
}
