import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendMessageVoid } from '@/shared/lib/runtime-client';
import type { TabSwitchItem } from '@/shared/types';
import { fuzzyFilter } from '@/shared/utils/fuzzy';
import { cn } from '@/shared/lib/utils';

const EVENT_OPEN = 'tabzen:open-search-palette';
const MAX_VISIBLE = 50;

interface State {
  open: boolean;
  items: TabSwitchItem[];
  query: string;
  selected: number;
}

const INITIAL: State = { open: false, items: [], query: '', selected: 0 };

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function SearchPalette() {
  const [state, setState] = useState<State>(INITIAL);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const filtered = useMemo(() => {
    return fuzzyFilter(state.query, state.items, (i) => [i.title, i.url]).slice(0, MAX_VISIBLE);
  }, [state.query, state.items]);

  // 結果件数が変わっても保持。表示時は filtered.length-1 にクランプして使う。
  const activeIdx = filtered.length === 0 ? 0 : Math.min(state.selected, filtered.length - 1);

  const close = useCallback(() => setState(INITIAL), []);

  const commit = useCallback((item: TabSwitchItem) => {
    setState(INITIAL);
    sendMessageVoid({ kind: 'switchToTab', tabId: item.tabId });
  }, []);

  useEffect(() => {
    const onOpen = (ev: Event) => {
      const detail = (ev as CustomEvent<{ items?: TabSwitchItem[] }>).detail;
      const items = detail?.items ?? [];
      setState({ open: true, items, query: '', selected: 0 });
    };
    window.addEventListener(EVENT_OPEN, onOpen);
    return () => window.removeEventListener(EVENT_OPEN, onOpen);
  }, []);

  useEffect(() => {
    if (state.open) {
      // 開いた直後に input にフォーカス。React の autoFocus は再オープン時に
      // 効かないことがあるので明示する。
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [state.open]);

  // 選択カーソルが画面外に行ったらスクロール追従。
  useEffect(() => {
    const ul = listRef.current;
    if (!ul) return;
    const el = ul.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!state.open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    // IME 変換中 (全角入力で未確定) のキーは無視する。Enter で IME 確定した
    // つもりがそのまま選択中タブを開いてしまうのを防ぐ。Safari など一部
    // 環境で isComposing が立たない場合に備えて keyCode 229 もチェック。
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filtered[activeIdx];
      if (target) commit(target);
    } else if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      if (filtered.length === 0) return;
      setState((s) => ({ ...s, selected: (activeIdx + 1) % filtered.length }));
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      if (filtered.length === 0) return;
      setState((s) => ({
        ...s,
        selected: (activeIdx - 1 + filtered.length) % filtered.length,
      }));
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-start justify-center pt-[10vh] bg-black/40 backdrop-blur-sm"
      onClick={close}
      style={{ pointerEvents: 'auto' }}
    >
      <div
        className="w-[640px] max-w-[92vw] bg-card text-card-foreground rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-border">
          <input
            ref={inputRef}
            type="text"
            value={state.query}
            onChange={(e) => setState((s) => ({ ...s, query: e.target.value, selected: 0 }))}
            onKeyDown={onKeyDown}
            placeholder="タブを検索 (タイトル / URL)…"
            className="w-full bg-transparent outline-none text-sm py-1.5 px-1 placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <ul ref={listRef} className="overflow-y-auto max-h-[60vh]">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted-foreground text-center">
              {state.items.length === 0 ? 'タブが見つかりません' : '一致するタブがありません'}
            </li>
          ) : (
            filtered.map((item, idx) => (
              <li key={item.tabId} data-idx={idx}>
                <button
                  type="button"
                  className={cn(
                    'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors border-l-4',
                    idx === activeIdx
                      ? 'bg-primary/15 border-primary'
                      : 'border-transparent hover:bg-accent/50',
                  )}
                  onClick={() => commit(item)}
                  onMouseEnter={() => setState((s) => ({ ...s, selected: idx }))}
                >
                  {item.favIconUrl ? (
                    <img src={item.favIconUrl} className="w-4 h-4 shrink-0" alt="" />
                  ) : (
                    <div className="w-4 h-4 rounded-sm bg-muted shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate font-medium">{item.title || item.url}</p>
                    <p className="text-xs text-muted-foreground truncate">{safeHost(item.url)}</p>
                  </div>
                  {item.suspended && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      suspended
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="px-3 py-1.5 border-t border-border text-[11px] text-muted-foreground flex items-center gap-3 shrink-0">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">↑↓</kbd> 移動
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Enter</kbd> 切替
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Esc</kbd> 閉じる
          </span>
          <span className="ml-auto tabular-nums">
            {filtered.length} / {state.items.length}
          </span>
        </div>
      </div>
    </div>
  );
}
