import { useCallback, useEffect, useRef, useState } from 'react';
import { sendMessageVoid } from '@/shared/lib/runtime-client';
import type { TabSwitchItem } from '@/shared/types';
import { relativeFromNow } from '@/shared/utils/time';
import { cn } from '@/shared/lib/utils';

interface State {
  open: boolean;
  items: TabSwitchItem[];
  selected: number;
}

const INITIAL: State = { open: false, items: [], selected: 0 };
const EVENT_TAB_SWITCH = 'tabzen:tab-switch';

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function TabSwitcherOverlay() {
  const [state, setState] = useState<State>(INITIAL);
  // stateRef は handler 内で同期更新する。React の自動バッチングで
  // setState の updater 実行が遅延されると、その間に到着する次の
  // メッセージが古い state を参照してしまう (race condition)。
  // setState には render 用に最新値を渡し、stateRef は handler 内で
  // 直接書き換えることで両者の食い違いを防ぐ。
  const stateRef = useRef<State>(INITIAL);

  const applyState = useCallback((next: State) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const close = useCallback(() => {
    applyState(INITIAL);
  }, [applyState]);

  const commitTabId = useCallback(
    (tabId: number) => {
      applyState(INITIAL);
      sendMessageVoid({ kind: 'switchToTab', tabId });
    },
    [applyState],
  );

  const commitCurrent = useCallback(() => {
    const cur = stateRef.current;
    if (!cur.open) return;
    const target = cur.items[cur.selected];
    if (target) sendMessageVoid({ kind: 'switchToTab', tabId: target.tabId });
    applyState(INITIAL);
  }, [applyState]);

  const moveBy = useCallback(
    (direction: 'next' | 'prev') => {
      const cur = stateRef.current;
      if (!cur.open) return;
      const total = cur.items.length;
      if (total === 0) return;
      const delta = direction === 'next' ? 1 : -1;
      const sel = (cur.selected + delta + total) % total;
      applyState({ ...cur, selected: sel });
    },
    [applyState],
  );

  useEffect(() => {
    const onTick = (ev: Event) => {
      const detail = (ev as CustomEvent<{ items?: TabSwitchItem[]; direction?: 'next' | 'prev' }>)
        .detail;
      const incoming = detail?.items ?? [];
      const direction = detail?.direction ?? 'next';

      const prev = stateRef.current;
      if (!prev.open) {
        if (incoming.length < 2) return;
        const selected = direction === 'next' ? 1 : incoming.length - 1;
        applyState({ open: true, items: incoming, selected });
      } else {
        const total = prev.items.length;
        if (total === 0) return;
        const delta = direction === 'next' ? 1 : -1;
        const sel = (prev.selected + delta + total) % total;
        applyState({ ...prev, selected: sel });
      }
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
      } else if (e.key === 'q' || e.key === 'Q') {
        // オーバーレイ表示中は修飾キー有無に関わらず Q で移動。
        // Shift で逆方向。Alt+Shift+Q が Mac で動かないケースの保険。
        e.preventDefault();
        e.stopPropagation();
        moveBy(e.shiftKey ? 'prev' : 'next');
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        moveBy('next');
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        moveBy('prev');
      }
    };

    // 修飾キー (Alt / Control / Meta) のいずれかをリリースしたら確定。
    // Mac の Chrome では chrome.commands に Alt+Q を登録しても実際は
    // Ctrl+Q として処理されることがあるため、いずれの修飾キーにも対応する。
    const onKeyUp = (e: KeyboardEvent) => {
      if (!stateRef.current.open) return;
      if (e.key === 'Alt' || e.key === 'Control' || e.key === 'Meta') {
        e.preventDefault();
        e.stopPropagation();
        commitCurrent();
      }
    };

    // ウィンドウから blur したら現在選択中のタブを確定する。
    // chrome.commands の Ctrl+Q (Mac) などはキーリリース時に keyup が
    // 届く前に blur が発火するケースがあるため、close ではなく commit。
    const onBlur = () => {
      if (stateRef.current.open) commitCurrent();
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
  }, [close, commitCurrent, moveBy, applyState]);

  if (!state.open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={close}
      style={{ pointerEvents: 'auto' }}
    >
      <div
        className="w-[720px] max-h-[92vh] bg-card text-card-foreground rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col"
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
                  'w-full px-4 py-2 flex items-center gap-3 text-left transition-colors',
                  'border-l-4',
                  idx === state.selected
                    ? 'bg-primary/15 border-primary'
                    : 'border-transparent hover:bg-accent/50',
                )}
                onClick={() => commitTabId(item.tabId)}
                onMouseEnter={() => {
                  const cur = stateRef.current;
                  if (cur.open) applyState({ ...cur, selected: idx });
                }}
              >
                {item.thumbnail ? (
                  <div className="relative w-[112px] h-[70px] rounded-sm bg-muted shrink-0 overflow-hidden border border-border">
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
                  <div className="w-[112px] h-[70px] rounded-sm bg-muted shrink-0 flex items-center justify-center">
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
