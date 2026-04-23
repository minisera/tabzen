import { useCallback, useEffect, useRef, useState } from 'react';
import type { TabMeta } from '@/shared/schema/tab-meta';
import { sendMessage } from '@/shared/lib/runtime-client';
import { relativeFromNow } from '@/shared/utils/time';
import { cn } from '@/shared/lib/utils';

interface State {
  open: boolean;
  items: TabMeta[];
  selected: number;
}

const INITIAL: State = { open: false, items: [], selected: 0 };
const EVENT_TAB_SWITCH_NEXT = 'tab-tidy:tab-switch-next';
const AUTO_COMMIT_MS = 1500;

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
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearTimer();
    setState(INITIAL);
  }, [clearTimer]);

  const commitTabId = useCallback(
    (tabId: number) => {
      clearTimer();
      setState(INITIAL);
      void sendMessage({ kind: 'switchToTab', tabId });
    },
    [clearTimer],
  );

  const commitCurrent = useCallback(() => {
    const cur = stateRef.current;
    if (!cur.open) return;
    const target = cur.items[cur.selected];
    if (target) {
      void sendMessage({ kind: 'switchToTab', tabId: target.tabId });
    }
    clearTimer();
    setState(INITIAL);
  }, [clearTimer]);

  const scheduleAutoCommit = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      commitCurrent();
    }, AUTO_COMMIT_MS);
  }, [clearTimer, commitCurrent]);

  useEffect(() => {
    const onNext = (ev: Event) => {
      const detail = (ev as CustomEvent<{ items?: TabMeta[] }>).detail;
      const incoming = detail?.items ?? [];
      const cur = stateRef.current;
      if (!cur.open) {
        if (incoming.length < 2) return;
        setState({ open: true, items: incoming, selected: 1 });
      } else {
        const total = cur.items.length;
        if (total === 0) return;
        const next = (cur.selected + 1) % total;
        setState({ ...cur, selected: next });
      }
      scheduleAutoCommit();
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

    window.addEventListener(EVENT_TAB_SWITCH_NEXT, onNext);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener(EVENT_TAB_SWITCH_NEXT, onNext);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [close, commitCurrent, scheduleAutoCommit]);

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
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Enter</kbd>
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
                  'w-full px-4 py-2 flex items-center gap-3 text-left transition-colors',
                  idx === state.selected ? 'bg-accent' : 'hover:bg-accent/50',
                )}
                onClick={() => commitTabId(item.tabId)}
                onMouseEnter={() => setState((s) => (s.open ? { ...s, selected: idx } : s))}
              >
                {item.favIconUrl ? (
                  <img src={item.favIconUrl} className="w-4 h-4 shrink-0" alt="" />
                ) : (
                  <div className="w-4 h-4 rounded-sm bg-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.title || item.url}</p>
                  <p className="text-xs text-muted-foreground truncate">{safeHost(item.url)}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {relativeFromNow(item.lastActiveAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
