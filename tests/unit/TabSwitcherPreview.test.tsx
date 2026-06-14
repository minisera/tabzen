import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TabSwitcherPreview } from '@/options/components/tab-switcher-preview';

describe('TabSwitcherPreview', () => {
  it('reflects vertical layout', () => {
    render(<TabSwitcherPreview layout="vertical" wrap={false} columns={4} />);
    expect(screen.getByTestId('tab-switcher-preview')).toHaveAttribute('data-layout', 'vertical');
  });

  it('reflects horizontal single-row (no wrap)', () => {
    render(<TabSwitcherPreview layout="horizontal" wrap={false} columns={4} />);
    const el = screen.getByTestId('tab-switcher-preview');
    expect(el).toHaveAttribute('data-layout', 'horizontal');
    expect(el).toHaveAttribute('data-wrap', 'false');
  });

  it('shows all cards without horizontal scroll when wrap is false', () => {
    render(<TabSwitcherPreview layout="horizontal" wrap={false} columns={4} />);
    expect(screen.getByTestId('tab-switcher-preview')).not.toHaveClass('overflow-x-auto');
  });

  it('reflects horizontal wrap with the configured column count', () => {
    render(<TabSwitcherPreview layout="horizontal" wrap columns={6} />);
    const el = screen.getByTestId('tab-switcher-preview');
    expect(el).toHaveAttribute('data-wrap', 'true');
    expect(el).toHaveAttribute('data-columns', '6');
  });
});
