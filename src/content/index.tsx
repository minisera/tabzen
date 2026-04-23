import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TabSwitcherOverlay } from './tab-switcher/TabSwitcherOverlay';
import { initFormDetector } from './form-detector';
import cssText from '@/shared/styles/globals.css?inline';
import type { ContentRequest } from '@/shared/types';

const HOST_ID = 'tab-tidy-root';
const EVENT_TAB_SWITCH = 'tab-tidy:tab-switch';

function mount() {
  if (document.getElementById(HOST_ID)) {
    console.log('[Tab Tidy][CS] mount: already mounted, skipping');
    return;
  }
  console.log('[Tab Tidy][CS] mount: starting');

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
  console.log('[Tab Tidy][CS] mount: done');
}

function isContentRequest(v: unknown): v is ContentRequest {
  if (typeof v !== 'object' || v === null) return false;
  const kind = (v as { kind?: unknown }).kind;
  return kind === 'confirm' || kind === 'tabSwitchCycle';
}

chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
  console.log('[Tab Tidy][CS] onMessage received:', raw);
  if (!isContentRequest(raw)) {
    console.log('[Tab Tidy][CS] onMessage: not a ContentRequest, ignoring');
    return false;
  }
  if (raw.kind === 'confirm') {
    const ok = window.confirm(raw.message);
    sendResponse({ ok });
    return false;
  }
  if (raw.kind === 'tabSwitchCycle') {
    console.log(
      '[Tab Tidy][CS] tabSwitchCycle',
      raw.direction,
      'with',
      raw.items.length,
      'items — dispatching CustomEvent',
    );
    window.dispatchEvent(
      new CustomEvent(EVENT_TAB_SWITCH, {
        detail: { items: raw.items, direction: raw.direction },
      }),
    );
    console.log('[Tab Tidy][CS] CustomEvent dispatched');
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

// React ルートは Shadow DOM 内で動くため、ページの DOMContentLoaded を
// 待つ必要はない。document_start で即座にマウントし、Alt+Q のメッセージ
// を受けた時点で必ずリスナーが登録されている状態にする。
mount();

initFormDetector();

console.log('[Tab Tidy] Content Script initialized on', location.href);
