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
  const cycleRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const close = useCallback(() => {
    setState(INITIAL);
    cycleRef.current = false;
  }, []);

  const commit = useCallback((tabId: number) => {
    setState(INITIAL);
    cycleRef.current = false;
    void sendMessage({ kind: 'switchToTab', tabId });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        const cur = stateRef.current;
        if (!cur.open) {
          cycleRef.current = true;
          sendMessage({ kind: 'getMruPreview' })
            .then((items) => {
              if (!cycleRef.current) return;
              if (items.length === 0) {
                cycleRef.current = false;
                return;
              }
              setState({ open: true, items, selected: Math.min(1, items.length - 1) });
            })
            .catch((err: unknown) => {
              cycleRef.current = false;
              console.error('[Tab Tidy] failed to load MRU', err);
            });
        } else {
          const delta = e.shiftKey ? -1 : 1;
          const total = cur.items.length;
          if (total > 0) {
            const next = (cur.selected + delta + total) % total;
            setState({ ...cur, selected: next });
          }
        }
        return;
      }

      if (e.key === 'Escape' && stateRef.current.open) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!cycleRef.current) return;
      if (e.key !== 'Control') return;
      cycleRef.current = false;
      const cur = stateRef.current;
      if (!cur.open) return;
      const target = cur.items[cur.selected];
      if (target) {
        void sendMessage({ kind: 'switchToTab', tabId: target.tabId });
      }
      setState(INITIAL);
    };

    const onBlur = () => {
      cycleRef.current = false;
      if (stateRef.current.open) setState(INITIAL);
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [close]);

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
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Ctrl+Tab</kbd>{' '}
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
                onClick={() => commit(item.tabId)}
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
