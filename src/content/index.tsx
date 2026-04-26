import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TabSwitcherOverlay } from './tab-switcher/TabSwitcherOverlay';
import { SearchPalette } from './search-palette/SearchPalette';
import { initFormDetector } from './form-detector';
import cssText from '@/shared/styles/globals.css?inline';
import type { ContentRequest } from '@/shared/types';

const HOST_ID = 'tabzen-root';
const EVENT_TAB_SWITCH = 'tabzen:tab-switch';
const EVENT_OPEN_SEARCH = 'tabzen:open-search-palette';
const CLEANUP_KEY = '__tabzenCleanup';

type Cleanup = () => void;

function mount(): Cleanup {
  // 念のため既存ホストを撤去 (拡張リロード後に旧 isolated world の
  // React ルートが残っている場合の保険)。
  document.getElementById(HOST_ID)?.remove();

  const host = document.createElement('div');
  host.id = HOST_ID;
  // popover="manual" で Top Layer に載せる。
  // 通常の position:fixed は祖先 (<html> 等) に transform/filter/contain/
  // backdrop-filter 等があると containing block が viewport ではなくその
  // 祖先になり、オーバーレイが縮んだり位置ずれを起こすことがあった
  // (Notion / Linear / 一部 Next.js サイト等)。Top Layer は祖先の CSS から
  // 完全に独立して viewport 直下にレンダリングされるためこれを根本解決する。
  // showPopover が無い古い Chrome (<114) では Top Layer 化されないだけで
  // 通常の fixed positioning として動作するためフォールバック動作になる。
  host.setAttribute('popover', 'manual');
  // popover の UA 既定 (margin: auto / width: fit-content / border / padding 等)
  // を inline で確実に上書きする。`all: initial` は popover の UA スタイルを
  // 含む user-agent origin より優先される。
  host.style.cssText =
    'all: initial; position: fixed; inset: 0; width: 100vw; height: 100vh; ' +
    'margin: 0; padding: 0; border: 0; background: transparent; ' +
    'overflow: visible; z-index: 2147483647; pointer-events: none;';
  document.documentElement.appendChild(host);

  if (typeof host.showPopover === 'function') {
    try {
      host.showPopover();
    } catch (e) {
      // ページ側で既に Top Layer に乗っている要素 (fullscreen 等) と
      // 衝突するレアケース。Top Layer 化を諦めて通常の fixed positioning に
      // フォールバック。
      console.warn('[Tab Zen] showPopover failed, falling back:', e);
    }
  }

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  // Tailwind v4 は @theme の変数を :root に展開するが、Shadow DOM では
  // :root が Shadow Root 自身にマッチしないので :host に置換する。
  style.textContent = cssText.replace(/:root/g, ':host');
  shadow.appendChild(style);

  const appRoot = document.createElement('div');
  appRoot.style.cssText = 'pointer-events: auto;';
  shadow.appendChild(appRoot);

  const root: Root = createRoot(appRoot);
  root.render(
    <StrictMode>
      <TabSwitcherOverlay />
      <SearchPalette />
    </StrictMode>,
  );

  return () => {
    try {
      root.unmount();
    } catch {
      // dead context — ignore
    }
    host.remove();
  };
}

function isContentRequest(v: unknown): v is ContentRequest {
  if (typeof v !== 'object' || v === null) return false;
  const kind = (v as { kind?: unknown }).kind;
  return kind === 'confirm' || kind === 'tabSwitchCycle' || kind === 'openSearchPalette';
}

// 二重初期化対策。下記 2 ケースを両方ハンドルする必要がある:
//
//   (a) 同一セッション内の二重注入: 拡張インストール直後に
//       injectContentScriptIntoExistingTabs (scripting.executeScript) と
//       ページリロード経由の manifest 自動注入が同時に走る。
//   (b) 拡張機能リロード後の再注入: 旧 isolated world の chrome.runtime
//       が無効化されるため、bridge listener を貼り直さないと
//       Ctrl+Q メッセージが届かなくなる。
//
// シンプルなブール flag だと (b) で「既に初期化済み」と誤判定して
// listener が貼り直されない。前回の cleanup 関数を window に持たせ、
// 毎回 teardown → 再初期化することで (a)(b) を共通の手順で処理する。
type WindowWithCleanup = Window & { [CLEANUP_KEY]?: Cleanup };
const w = window as WindowWithCleanup;

if (w[CLEANUP_KEY]) {
  try {
    w[CLEANUP_KEY]();
  } catch {
    // 旧 isolated world の chrome.runtime は dead — 例外は握りつぶす
  }
}

const cleanups: Cleanup[] = [];

const messageListener = (
  raw: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean => {
  if (!isContentRequest(raw)) return false;
  if (raw.kind === 'confirm') {
    const ok = window.confirm(raw.message);
    sendResponse({ ok });
    return false;
  }
  if (raw.kind === 'tabSwitchCycle') {
    window.dispatchEvent(
      new CustomEvent(EVENT_TAB_SWITCH, {
        detail: { items: raw.items, direction: raw.direction },
      }),
    );
    sendResponse({ ok: true });
    return false;
  }
  if (raw.kind === 'openSearchPalette') {
    window.dispatchEvent(
      new CustomEvent(EVENT_OPEN_SEARCH, {
        detail: { items: raw.items },
      }),
    );
    sendResponse({ ok: true });
    return false;
  }
  return false;
};
chrome.runtime.onMessage.addListener(messageListener);
cleanups.push(() => {
  try {
    chrome.runtime.onMessage.removeListener(messageListener);
  } catch {
    /* dead context */
  }
});

// React ルートは Shadow DOM 内で動くため、ページの DOMContentLoaded を
// 待つ必要はない。document_start で即座にマウントし、Ctrl+Q のメッセージ
// を受けた時点で必ずリスナーが登録されている状態にする。
cleanups.push(mount());
cleanups.push(initFormDetector());

w[CLEANUP_KEY] = () => {
  for (const fn of cleanups) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
};

console.log('[Tab Zen] Content Script initialized on', location.href);
