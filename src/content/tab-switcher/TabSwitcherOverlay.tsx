import { useCallback, useEffect, useRef, useState } from 'react';
import { sendMessageVoid } from '@/shared/lib/runtime-client';
import type { TabSwitchItem } from '@/shared/types';
import { relativeFromNow } from '@/shared/utils/time';
import { cn } from '@/shared/lib/utils';

type TabSwitcherLayout = 'vertical' | 'horizontal';

interface State {
  open: boolean;
  items: TabSwitchItem[];
  selected: number;
  layout: TabSwitcherLayout;
  wrap: boolean;
  columns: number;
}

const INITIAL: State = {
  open: false,
  items: [],
  selected: 0,
  layout: 'vertical',
  wrap: false,
  columns: 4,
};
const EVENT_TAB_SWITCH = 'tabzen:tab-switch';

// 横レイアウト (折り返しあり) のカード寸法。コンテナ幅を「ちょうど N 列」に
// 固定することで flex-wrap が指定列数で折り返す。w-[180px] / gap-3 / p-4 に対応。
const H_CARD_W = 180;
const H_GAP = 12;
const H_PAD = 16;
function horizontalGridWidth(columns: number): number {
  return H_CARD_W * columns + H_GAP * (columns - 1) + H_PAD * 2;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// 縦レイアウト: 横長カードを縦に積む (従来動作)。サムネイル左・テキスト右。
function VerticalItemContent({ item }: { item: TabSwitchItem }) {
  return (
    <>
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
        <p className="text-xs text-muted-foreground">{relativeFromNow(item.lastActiveAt)}</p>
      </div>
    </>
  );
}

// 横レイアウト: サムネイル上・タイトル下のカード (macOS Cmd+Tab 風)。
function HorizontalItemContent({ item }: { item: TabSwitchItem }) {
  return (
    <>
      {item.thumbnail ? (
        <div className="relative w-full h-[130px] bg-muted overflow-hidden border-b border-border">
          <img src={item.thumbnail} className="w-full h-full object-cover" alt="" />
          {item.favIconUrl && (
            <img
              src={item.favIconUrl}
              className="absolute bottom-1 right-1 w-4 h-4 rounded-sm bg-white/80 p-0.5"
              alt=""
            />
          )}
        </div>
      ) : (
        <div className="w-full h-[130px] bg-muted flex items-center justify-center border-b border-border">
          {item.favIconUrl ? (
            <img src={item.favIconUrl} className="w-8 h-8" alt="" />
          ) : (
            <div className="w-8 h-8 rounded-sm bg-card" />
          )}
        </div>
      )}
      <div className="p-2 w-full min-w-0">
        <p className="text-sm truncate font-medium">{item.title || item.url}</p>
        <p className="text-xs text-muted-foreground truncate">{safeHost(item.url)}</p>
      </div>
    </>
  );
}

export function TabSwitcherOverlay() {
  const [state, setState] = useState<State>(INITIAL);
  // stateRef は handler 内で同期更新する。React の自動バッチングで
  // setState の updater 実行が遅延されると、その間に到着する次の
  // メッセージが古い state を参照してしまう (race condition)。
  // setState には render 用に最新値を渡し、stateRef は handler 内で
  // 直接書き換えることで両者の食い違いを防ぐ。
  const stateRef = useRef<State>(INITIAL);
  // オーバーレイは画面中央に固定表示されるため、開いた瞬間のカーソル直下に
  // アイテムが出現しがちで、Chrome が要素出現時にも mouseenter を発火する
  // 仕様や、わずかな手の震えで意図しないホバー選択が走ってしまう。
  // 「ユーザーが実際に意図して動かした」と判定するまでは onMouseEnter を
  // 無視するためのフラグ。閾値 (5px) 未満の動きは誤反応とみなす。
  const mouseMovedRef = useRef(false);
  const mouseOriginRef = useRef<{ x: number; y: number } | null>(null);
  // 修飾キー (Ctrl/Alt/Meta) の押下状態を継続的に追跡する。
  // SW → CS の chrome.tabs.sendMessage は IPC で数 ms〜数十 ms の遅延があり、
  // その間にユーザーが Ctrl を離してしまうと、onKeyUp は stateRef.open=false で
  // 早期 return して逃され、その後遅れて到着した onTick でオーバーレイを開いても
  // 閉じる手段 (modifier release) が来ない → 永遠に残る不具合があった。
  // 修飾キーの状態を別途持っておくことで、onTick 時点で「既に離されている」
  // 状態を検出し、オーバーレイを開かず即 commit する判断材料にする。
  const modifierDownRef = useRef<Set<string>>(new Set());
  // 選択中の項目への参照。選択移動時にスクロール追従させるために使う。
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);

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
      const detail = (
        ev as CustomEvent<{
          items?: TabSwitchItem[];
          direction?: 'next' | 'prev';
          assumeModifierDown?: boolean;
          layout?: TabSwitcherLayout;
          wrap?: boolean;
          columns?: number;
        }>
      ).detail;
      const incoming = detail?.items ?? [];
      const direction = detail?.direction ?? 'next';
      const assumeModifierDown = detail?.assumeModifierDown ?? false;
      const layout = detail?.layout ?? 'vertical';
      const wrap = detail?.wrap ?? false;
      const columns = detail?.columns ?? 4;

      const prev = stateRef.current;
      if (!prev.open) {
        if (incoming.length < 2) return;
        const selected = direction === 'next' ? 1 : incoming.length - 1;
        // race condition の保険: SW→CS の IPC 遅延中にユーザーが既に
        // 修飾キーを離してしまっていた場合、オーバーレイを開いても閉じる
        // 手段が無くなる。modifier が押されていない状態でメッセージが
        // 届いたら、即座に対象タブへ切り替えて終了する (タップでの cycle 動作)。
        //
        // ただし assumeModifierDown=true (SW が chrome.commands 起点で
        // 送信したヒント) の場合は、アドレスバーフォーカス中など Web ページが
        // keydown を取得できないだけで実際は修飾キーが押されている可能性が
        // 高い。この場合は Overlay を開く。閉じる手段はマウスクリック/
        // Esc (アドレスバーを閉じてから再度 Esc) で確保する。
        if (modifierDownRef.current.size === 0 && !assumeModifierDown) {
          const target = incoming[selected];
          if (target) sendMessageVoid({ kind: 'switchToTab', tabId: target.tabId });
          return;
        }
        // 開いた直後のカーソル位置に基づくホバー選択を抑止するため、
        // フラグと基点をリセットする。
        mouseMovedRef.current = false;
        mouseOriginRef.current = null;
        applyState({ open: true, items: incoming, selected, layout, wrap, columns });
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
        // Shift で逆方向。Ctrl+Shift+Q が Mac で動かないケースの保険。
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
    // Mac でも Ctrl は通常タブ切替に使われていないため Ctrl をデフォルトに。
    // ユーザーが Alt+Q や Cmd+Q に再割り当てしても動くよう、いずれの修飾
    // キーリリースでも commit する。
    const onKeyUp = (e: KeyboardEvent) => {
      if (!stateRef.current.open) return;
      if (e.key === 'Alt' || e.key === 'Control' || e.key === 'Meta') {
        e.preventDefault();
        e.stopPropagation();
        commitCurrent();
      }
    };

    // 修飾キーの押下状態を継続的に追跡する。state.open に依存せず常に動かす
    // 必要があるため、onKeyDown/onKeyUp とは別のリスナーで処理する。
    const onAnyKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
        modifierDownRef.current.add(e.key);
      }
    };
    const onAnyKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
        modifierDownRef.current.delete(e.key);
      }
    };

    // ウィンドウから blur したら現在選択中のタブを確定する。
    // chrome.commands の Ctrl+Q (Mac) などはキーリリース時に keyup が
    // 届く前に blur が発火するケースがあるため、close ではなく commit。
    // フォーカスを失うと keyup を取り逃す可能性があるので、修飾キー状態も
    // 一旦クリアして、次に開く時に確実に「押されていない」と判定できるようにする。
    const onBlur = () => {
      modifierDownRef.current.clear();
      if (stateRef.current.open) commitCurrent();
    };

    window.addEventListener(EVENT_TAB_SWITCH, onTick);
    document.addEventListener('keydown', onAnyKeyDown, true);
    document.addEventListener('keyup', onAnyKeyUp, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener(EVENT_TAB_SWITCH, onTick);
      document.removeEventListener('keydown', onAnyKeyDown, true);
      document.removeEventListener('keyup', onAnyKeyUp, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [close, commitCurrent, moveBy, applyState]);

  // 選択が移動したら、その項目が見えるようスクロール追従する。
  // 横一列 (折り返しなし) では選択が右へ進むと画面外に出るため必須。
  // 縦リストや折り返しグリッドでも項目が多い時に追従する。
  useEffect(() => {
    if (!state.open) return;
    selectedItemRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [state.open, state.selected]);

  if (!state.open) return null;

  // 折り返しグリッドのときだけコンテナ幅を列数ぴったりに固定する。
  const horizontal = state.layout === 'horizontal';
  const gridMode = horizontal && state.wrap;
  const cardStyle = gridMode
    ? { width: horizontalGridWidth(state.columns), maxWidth: '92vw' }
    : undefined;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={close}
      onMouseMove={(e) => {
        if (mouseMovedRef.current) return;
        if (mouseOriginRef.current === null) {
          mouseOriginRef.current = { x: e.clientX, y: e.clientY };
          return;
        }
        const dx = e.clientX - mouseOriginRef.current.x;
        const dy = e.clientY - mouseOriginRef.current.y;
        if (dx * dx + dy * dy >= 25) {
          mouseMovedRef.current = true;
        }
      }}
      style={{ pointerEvents: 'auto' }}
    >
      <div
        // max-w: 狭い viewport (DevTools 横置き / 小型ノート / 縦分割) で
        // 720px がはみ出すのを防ぐ。
        // min-h: MRU 履歴が 1〜2 件しかない時にカードがヘッダー + 数十 px
        // しか無い極小サイズになるのを防ぐ (空の余白で良いのでスケールを
        // 一定以上に保つ)。
        className={cn(
          'min-h-[280px] max-h-[92vh] bg-card text-card-foreground rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col',
          gridMode
            ? 'max-w-[92vw]'
            : horizontal
              ? // 折り返しなし (全件均等表示) は広めに取って各カードを大きく。
                'w-[1200px] max-w-[92vw]'
              : 'w-[720px] max-w-[92vw]',
        )}
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-2 border-b border-border flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <span>最近のタブ</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Ctrl+Q</kbd>
            <span>次</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Ctrl+Shift+Q</kbd>
            <span>前</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Ctrl↑</kbd>
            <span>確定</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Esc</kbd>
          </span>
        </div>
        <ul
          data-testid="tab-switcher-list"
          data-layout={state.layout}
          data-wrap={String(state.wrap)}
          data-columns={state.columns}
          className={cn(
            state.layout === 'horizontal'
              ? state.wrap
                ? 'flex flex-wrap gap-3 justify-center content-start p-4 overflow-y-auto'
                : 'flex flex-nowrap gap-3 p-4'
              : 'overflow-y-auto',
          )}
        >
          {state.items.map((item, idx) => {
            const active = idx === state.selected;
            return (
              <li
                key={item.tabId}
                className={cn(
                  state.layout === 'horizontal' &&
                    // 折り返しあり: 160px 固定でグリッド。折り返しなし: 均等幅で
                    // 全件を 1 行に収める (スクロールさせない)。
                    (state.wrap ? 'shrink-0' : 'flex-1 min-w-0'),
                )}
              >
                <button
                  type="button"
                  ref={active ? selectedItemRef : undefined}
                  className={cn(
                    'text-left transition-colors',
                    state.layout === 'horizontal'
                      ? cn(
                          state.wrap ? 'w-[180px]' : 'w-full',
                          'flex flex-col rounded-lg overflow-hidden border-2',
                          active
                            ? 'bg-primary/15 border-primary'
                            : 'border-transparent hover:bg-accent/50',
                        )
                      : cn(
                          'w-full px-4 py-2 flex items-center gap-3 border-l-4',
                          active
                            ? 'bg-primary/15 border-primary'
                            : 'border-transparent hover:bg-accent/50',
                        ),
                  )}
                  onClick={() => commitTabId(item.tabId)}
                  onMouseEnter={() => {
                    if (!mouseMovedRef.current) return;
                    const cur = stateRef.current;
                    if (cur.open) applyState({ ...cur, selected: idx });
                  }}
                >
                  {state.layout === 'horizontal' ? (
                    <HorizontalItemContent item={item} />
                  ) : (
                    <VerticalItemContent item={item} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
