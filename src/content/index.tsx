import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TabSwitcherOverlay } from './tab-switcher/TabSwitcherOverlay';
import { initFormDetector } from './form-detector';
import cssText from '@/shared/styles/globals.css?inline';
import type { ContentRequest } from '@/shared/types';

const HOST_ID = 'tabzen-root';
const EVENT_TAB_SWITCH = 'tabzen:tab-switch';
const INIT_FLAG = '__tabzen_content_initialized__';

function mount() {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText =
    'all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  // Tailwind v4 は @theme の変数を :root に展開するが、Shadow DOM では
  // :root が Shadow Root 自身にマッチしないので :host に置換する。
  style.textContent = cssText.replace(/:root/g, ':host');
  shadow.appendChild(style);

  const appRoot = document.createElement('div');
  appRoot.style.cssText = 'pointer-events: auto;';
  shadow.appendChild(appRoot);

  createRoot(appRoot).render(
    <StrictMode>
      <TabSwitcherOverlay />
    </StrictMode>,
  );
}

function isContentRequest(v: unknown): v is ContentRequest {
  if (typeof v !== 'object' || v === null) return false;
  const kind = (v as { kind?: unknown }).kind;
  return kind === 'confirm' || kind === 'tabSwitchCycle';
}

// 拡張更新時の chrome.scripting.executeScript 再注入と、その後の
// ページリロードによる manifest content_scripts 自動注入が重なると、
// 同一ページで content script が 2 回実行されて chrome.runtime.onMessage
// が二重登録される。結果、Ctrl+Q 1 回で selected が 2 つ進むなどの
// 重複動作が発生するため、ISOLATED world 上の window にフラグを置いて
// 2 回目の初期化を抑止する。
type WindowWithFlag = Window & { [INIT_FLAG]?: boolean };
const w = window as WindowWithFlag;
if (w[INIT_FLAG]) {
  console.log('[Tab Zen] already initialized, skipping duplicate injection');
} else {
  w[INIT_FLAG] = true;

  chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
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
    return false;
  });

  // React ルートは Shadow DOM 内で動くため、ページの DOMContentLoaded を
  // 待つ必要はない。document_start で即座にマウントし、Ctrl+Q のメッセージ
  // を受けた時点で必ずリスナーが登録されている状態にする。
  mount();

  initFormDetector();

  console.log('[Tab Zen] Content Script initialized on', location.href);
}
