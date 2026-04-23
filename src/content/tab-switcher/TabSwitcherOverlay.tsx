import { useCallback, useEffect, useRef, useState } from 'react';
import { sendMessage } from '@/shared/lib/runtime-client';
import type { TabSwitchItem } from '@/shared/types';
import { relativeFromNow } from '@/shared/utils/time';
import { cn } from '@/shared/lib/utils';

interface State {
  open: boolean;
  items: TabSwitchItem[];
  selected: number;
}

const INITIAL: State = { open: false, items: [], selected: 0 };
const EVENT_TAB_SWITCH = 'tab-tidy:tab-switch';
/** Alt リリースを取り逃した場合の保険タイムアウト (5 秒) */
const FALLBACK_COMMIT_MS = 5000;

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function TabSwitcherOverlay() {
  const [state, setState] = useState<State>(INITIAL);
  // state を setState 実行時に同期的に反映する ref。
  // keyup / CustomEvent ハンドラから最新値を参照するのに使う
  // (useEffect 経由だと1レンダー遅れて race condition が起きる)。
  const stateRef = useRef<State>(INITIAL);
  const timerRef = useRef<number | null>(null);

  const updateState = useCallback((updater: (prev: State) => State) => {
    setState((prev) => {
      const next = updater(prev);
      stateRef.current = next;
      return next;
    });
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleFallbackCommit = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const cur = stateRef.current;
      if (!cur.open) return;
      const target = cur.items[cur.selected];
      if (target) void sendMessage({ kind: 'switchToTab', tabId: target.tabId });
      updateState(() => INITIAL);
    }, FALLBACK_COMMIT_MS);
  }, [clearTimer, updateState]);

  const close = useCallback(() => {
    clearTimer();
    updateState(() => INITIAL);
  }, [clearTimer, updateState]);

  const commitTabId = useCallback(
    (tabId: number) => {
      clearTimer();
      updateState(() => INITIAL);
      void sendMessage({ kind: 'switchToTab', tabId });
    },
    [clearTimer, updateState],
  );

  const commitCurrent = useCallback(() => {
    clearTimer();
    const cur = stateRef.current;
    if (!cur.open) return;
    const target = cur.items[cur.selected];
    if (target) void sendMessage({ kind: 'switchToTab', tabId: target.tabId });
    updateState(() => INITIAL);
  }, [clearTimer, updateState]);

  useEffect(() => {
    console.log('[Tab Tidy][Overlay] useEffect setup: registering listeners');
    const onTick = (ev: Event) => {
      const detail = (ev as CustomEvent<{ items?: TabSwitchItem[]; direction?: 'next' | 'prev' }>)
        .detail;
      const incoming = detail?.items ?? [];
      const direction = detail?.direction ?? 'next';
      console.log(
        '[Tab Tidy][Overlay] onTick received',
        direction,
        'items:',
        incoming.length,
        'current state.open:',
        stateRef.current.open,
      );

      updateState((prev) => {
        if (!prev.open) {
          if (incoming.length < 2) {
            console.log('[Tab Tidy][Overlay] onTick: not opening (items < 2)');
            return prev;
          }
          const selected = direction === 'next' ? 1 : incoming.length - 1;
          console.log('[Tab Tidy][Overlay] overlay open', { direction, selected });
          return { open: true, items: incoming, selected };
        }
        const total = prev.items.length;
        if (total === 0) return prev;
        const delta = direction === 'next' ? 1 : -1;
        const next = (prev.selected + delta + total) % total;
        console.log('[Tab Tidy][Overlay] overlay move', prev.selected, '→', next);
        return { ...prev, selected: next };
      });
      scheduleFallbackCommit();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!stateRef.current.open) return;
      console.log('[Tab Tidy][Overlay] keydown while open:', e.key);
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        commitCurrent();
      }
    };

    // 修飾キー (Alt / Control / Meta) のいずれかをリリースしたら確定。
    // Mac の Chrome では chrome.commands に Alt+Q を登録しても実際は
    // Ctrl+Q として処理されることがあるため、いずれの修飾キーにも対応する。
    const onKeyUp = (e: KeyboardEvent) => {
      if (!stateRef.current.open) return;
      console.log('[Tab Tidy][Overlay] keyup while open:', e.key);
      if (e.key === 'Alt' || e.key === 'Control' || e.key === 'Meta') {
        e.preventDefault();
        e.stopPropagation();
        commitCurrent();
      }
    };

    const onBlur = () => {
      if (stateRef.current.open) {
        console.log('[Tab Tidy][Overlay] blur while open — closing');
        close();
      }
    };

    window.addEventListener(EVENT_TAB_SWITCH, onTick);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      console.log('[Tab Tidy][Overlay] useEffect cleanup: removing listeners');
      window.removeEventListener(EVENT_TAB_SWITCH, onTick);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      clearTimer();
    };
  }, [close, clearTimer, commitCurrent, scheduleFallbackCommit, updateState]);

  if (!state.open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={close}
      style={{ pointerEvents: 'auto' }}
    >
      <div
        className="w-[520px] max-h-[70vh] bg-card text-card-foreground rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-2 border-b border-border flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <span>最近のタブ</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Alt+Q</kbd>
            <span>次</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Alt+Shift+Q</kbd>
            <span>前</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">修飾キー↑</kbd>
            <span>確定</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Esc</kbd>
          </span>
        </div>
        <ul className="overflow-y-auto">
          {state.items.map((item, idx) => (
            <li key={item.tabId}>
              <button
                type="button"
                className={cn(
                  'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
                  idx === state.selected ? 'bg-accent' : 'hover:bg-accent/50',
                )}
                onClick={() => commitTabId(item.tabId)}
                onMouseEnter={() => updateState((s) => (s.open ? { ...s, selected: idx } : s))}
              >
                {item.thumbnail ? (
                  <div className="relative w-[96px] h-[60px] rounded-sm bg-muted shrink-0 overflow-hidden border border-border">
                    <img src={item.thumbnail} className="w-full h-full object-cover" alt="" />
                    {item.favIconUrl && (
                      <img
                        src={item.favIconUrl}
                        className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-sm bg-white/80 p-0.5"
                        alt=""
                      />
                    )}
                  </div>
                ) : (
                  <div className="w-[96px] h-[60px] rounded-sm bg-muted shrink-0 flex items-center justify-center">
                    {item.favIconUrl ? (
                      <img src={item.favIconUrl} className="w-6 h-6" alt="" />
                    ) : (
                      <div className="w-6 h-6 rounded-sm bg-card" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate font-medium">{item.title || item.url}</p>
                  <p className="text-xs text-muted-foreground truncate">{safeHost(item.url)}</p>
                  <p className="text-xs text-muted-foreground">
                    {relativeFromNow(item.lastActiveAt)}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
