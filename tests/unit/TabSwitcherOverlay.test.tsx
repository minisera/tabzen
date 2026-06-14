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
