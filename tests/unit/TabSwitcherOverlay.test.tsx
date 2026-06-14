import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TabSwitchItem } from '@/shared/types';
import { TabSwitcherOverlay } from '@/content/tab-switcher/TabSwitcherOverlay';

const EVENT_TAB_SWITCH = 'tabzen:tab-switch';

function makeItem(tabId: number): TabSwitchItem {
  return {
    tabId,
    windowId: 1,
    url: `https://example.com/${tabId}`,
    title: `Tab ${tabId}`,
    lastActiveAt: 1_000 * tabId,
    pinned: false,
    audible: false,
    formDirty: false,
    suspended: false,
  };
}

/**
 * Overlay は window の CustomEvent で開く。assumeModifierDown=true を渡すと
 * 修飾キー押下状態を問わず Overlay が開く (タップ cycle に落ちない)。
 */
function openOverlay(detail: {
  items: TabSwitchItem[];
  direction?: 'next' | 'prev';
  layout?: 'vertical' | 'horizontal';
  wrap?: boolean;
  columns?: number;
}) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent(EVENT_TAB_SWITCH, {
        detail: { direction: 'next', assumeModifierDown: true, ...detail },
      }),
    );
  });
}

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: { id: 'test', sendMessage: vi.fn(() => Promise.resolve({ ok: true })) },
  });
  // happy-dom は scrollIntoView を実装しないため、選択追従スクロールの呼び出しで
  // TypeError にならないよう no-op を差し込む。
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TabSwitcherOverlay layout', () => {
  it('renders the list in horizontal layout when layout is horizontal', () => {
    render(<TabSwitcherOverlay />);
    openOverlay({ items: [makeItem(1), makeItem(2)], layout: 'horizontal' });
    expect(screen.getByTestId('tab-switcher-list')).toHaveAttribute('data-layout', 'horizontal');
  });

  it('renders the list in vertical layout when layout is vertical', () => {
    render(<TabSwitcherOverlay />);
    openOverlay({ items: [makeItem(1), makeItem(2)], layout: 'vertical' });
    expect(screen.getByTestId('tab-switcher-list')).toHaveAttribute('data-layout', 'vertical');
  });

  it('defaults to vertical layout when no layout is provided', () => {
    render(<TabSwitcherOverlay />);
    openOverlay({ items: [makeItem(1), makeItem(2)] });
    expect(screen.getByTestId('tab-switcher-list')).toHaveAttribute('data-layout', 'vertical');
  });
});

describe('TabSwitcherOverlay horizontal wrap', () => {
  it('renders a single row (no wrap) when wrap is false', () => {
    render(<TabSwitcherOverlay />);
    openOverlay({ items: [makeItem(1), makeItem(2)], layout: 'horizontal', wrap: false });
    expect(screen.getByTestId('tab-switcher-list')).toHaveAttribute('data-wrap', 'false');
  });

  it('wraps into a grid when wrap is true', () => {
    render(<TabSwitcherOverlay />);
    openOverlay({ items: [makeItem(1), makeItem(2)], layout: 'horizontal', wrap: true });
    expect(screen.getByTestId('tab-switcher-list')).toHaveAttribute('data-wrap', 'true');
  });

  it('shows all cards in one row without horizontal scroll when wrap is false', () => {
    render(<TabSwitcherOverlay />);
    openOverlay({ items: [makeItem(1), makeItem(2)], layout: 'horizontal', wrap: false });
    const el = screen.getByTestId('tab-switcher-list');
    expect(el).toHaveClass('flex-nowrap');
    expect(el).not.toHaveClass('overflow-x-auto');
  });

  it('reflects the configured column count when wrapping', () => {
    render(<TabSwitcherOverlay />);
    openOverlay({
      items: [makeItem(1), makeItem(2)],
      layout: 'horizontal',
      wrap: true,
      columns: 6,
    });
    expect(screen.getByTestId('tab-switcher-list')).toHaveAttribute('data-columns', '6');
  });

  it('defaults to no wrap when wrap is not provided', () => {
    render(<TabSwitcherOverlay />);
    openOverlay({ items: [makeItem(1), makeItem(2)], layout: 'horizontal' });
    expect(screen.getByTestId('tab-switcher-list')).toHaveAttribute('data-wrap', 'false');
  });
});

describe('TabSwitcherOverlay close on modifier release', () => {
  it('commits the selection and closes when the modifier key is released', () => {
    render(<TabSwitcherOverlay />);
    openOverlay({ items: [makeItem(1), makeItem(2)] });
    expect(screen.getByTestId('tab-switcher-list')).toBeInTheDocument();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));
    });
    expect(screen.queryByTestId('tab-switcher-list')).not.toBeInTheDocument();
  });
});

describe('TabSwitcherOverlay auto-dismiss when the page cannot receive keys', () => {
  // アドレスバー (omnibox) にフォーカスがある状態で Ctrl+Q を押すと、ページの
  // document は system キーボードフォーカスを持たない (document.hasFocus()===false)。
  // この場合 Ctrl の keyup がページに届かないため keyup では閉じられず、さらに
  // ページ JS は omnibox からフォーカスを奪えないので focus() しても無意味。
  // そのため「フォーカスが無い間は一定時間後に自動確定して閉じる」フォールバックが
  // 必要 (SW 側 tickDirectCycle の time-based cycle と同じ考え方)。
  it('auto-commits and closes after a delay when the document has no focus', () => {
    vi.useFakeTimers();
    const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    try {
      render(<TabSwitcherOverlay />);
      openOverlay({ items: [makeItem(1), makeItem(2)] });
      expect(screen.getByTestId('tab-switcher-list')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.queryByTestId('tab-switcher-list')).not.toBeInTheDocument();
    } finally {
      hasFocus.mockRestore();
      vi.useRealTimers();
    }
  });

  it('does NOT auto-dismiss while the page has focus (closes via key release instead)', () => {
    vi.useFakeTimers();
    const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    try {
      render(<TabSwitcherOverlay />);
      openOverlay({ items: [makeItem(1), makeItem(2)] });
      expect(screen.getByTestId('tab-switcher-list')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      // フォーカスがある通常時はタイマーで勝手に閉じない (keyup で閉じる)。
      expect(screen.getByTestId('tab-switcher-list')).toBeInTheDocument();
    } finally {
      hasFocus.mockRestore();
      vi.useRealTimers();
    }
  });
});
