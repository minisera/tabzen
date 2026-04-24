import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function stubChrome(responses: Record<string, unknown>) {
  vi.stubGlobal('chrome', {
    runtime: {
      openOptionsPage: vi.fn(),
      getURL: (p: string) => `chrome-extension://test/${p}`,
      sendMessage: vi.fn((req: { kind: string }) => {
        if (req.kind in responses) {
          return Promise.resolve({ ok: true, data: responses[req.kind] });
        }
        return Promise.resolve({ ok: false, error: `unexpected: ${req.kind}` });
      }),
    },
    tabs: {
      create: vi.fn(),
    },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('Popup App', () => {
  it('renders header and three quick actions', async () => {
    stubChrome({
      getStats: { totalTabs: 5, closeCandidates: 2, managedCount: 4, suspendedCount: 1 },
      listHistory: [],
    });
    const { default: App } = await import('@/popup/App');
    render(<App />);
    expect(await screen.findByText('Tab Zen')).toBeInTheDocument();
    expect(await screen.findByText('クローズ閾値超のタブを閉じる')).toBeInTheDocument();
    expect(await screen.findByText('重複タブを閉じる')).toBeInTheDocument();
    expect(await screen.findByText('全タブをサスペンド')).toBeInTheDocument();
  });

  it('shows aggregate stats', async () => {
    stubChrome({
      getStats: { totalTabs: 17, closeCandidates: 3, managedCount: 10, suspendedCount: 4 },
      listHistory: [],
    });
    const { default: App } = await import('@/popup/App');
    render(<App />);
    expect(await screen.findByText('17')).toBeInTheDocument();
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(await screen.findByText('4')).toBeInTheDocument();
  });

  it('shows empty message when history is empty', async () => {
    stubChrome({
      getStats: { totalTabs: 0, closeCandidates: 0, managedCount: 0, suspendedCount: 0 },
      listHistory: [],
    });
    const { default: App } = await import('@/popup/App');
    render(<App />);
    expect(
      await screen.findByText('自動クローズされたタブがここに表示されます。'),
    ).toBeInTheDocument();
  });
});
