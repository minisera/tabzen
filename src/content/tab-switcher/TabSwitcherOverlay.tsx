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

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function TabSwitcherOverlay() {
  const [state, setState] = useState<State>(INITIAL);
  const stateRef = useRef<State>(INITIAL);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const close = useCallback(() => {
    setState(INITIAL);
  }, []);

  const commitTabId = useCallback((tabId: number) => {
    setState(INITIAL);
    void sendMessage({ kind: 'switchToTab', tabId });
  }, []);

  const commitCurrent = useCallback(() => {
    const cur = stateRef.current;
    if (!cur.open) return;
    const target = cur.items[cur.selected];
    if (target) {
      void sendMessage({ kind: 'switchToTab', tabId: target.tabId });
    }
    setState(INITIAL);
  }, []);

  useEffect(() => {
    const onTick = (ev: Event) => {
      const detail = (ev as CustomEvent<{ items?: TabSwitchItem[]; direction?: 'next' | 'prev' }>)
        .detail;
      const incoming = detail?.items ?? [];
      const direction = detail?.direction ?? 'next';
      const cur = stateRef.current;

      if (!cur.open) {
        if (incoming.length < 2) return;
        // 初回: 2番目 (next) または 末尾 (prev) を選択
        const selected = direction === 'next' ? 1 : incoming.length - 1;
        setState({ open: true, items: incoming, selected });
        return;
      }

      const total = cur.items.length;
      if (total === 0) return;
      const delta = direction === 'next' ? 1 : -1;
      const next = (cur.selected + delta + total) % total;
      setState({ ...cur, selected: next });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!stateRef.current.open) return;
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

    // Alt (macOS でも Option = Alt) リリースで確定。ユーザーが Alt+Q を
    // 押して Alt を離すまで巡回する Cmd+Tab ライクな UX。
    const onKeyUp = (e: KeyboardEvent) => {
      if (!stateRef.current.open) return;
      if (e.key === 'Alt') {
        e.preventDefault();
        e.stopPropagation();
        commitCurrent();
      }
    };

    const onBlur = () => {
      if (stateRef.current.open) setState(INITIAL);
    };

    window.addEventListener(EVENT_TAB_SWITCH, onTick);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener(EVENT_TAB_SWITCH, onTick);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [close, commitCurrent]);

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
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Alt↑</kbd>
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
                onMouseEnter={() => setState((s) => (s.open ? { ...s, selected: idx } : s))}
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
