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
