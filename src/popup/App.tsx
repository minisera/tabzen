import { useCallback, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Moon,
  RotateCw,
  Settings as Cog,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';
import { sendMessage } from '@/shared/lib/runtime-client';
import { usePopupData } from '@/shared/hooks/usePopupData';
import { relativeFromNow } from '@/shared/utils/time';

export default function App() {
  const { stats, history, loading, error, refresh } = usePopupData();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runAction = useCallback(
    async (key: string, fn: () => Promise<string>) => {
      setPending(key);
      setMessage(null);
      try {
        const text = await fn();
        setMessage(text);
        await refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : String(e));
      } finally {
        setPending(null);
      }
    },
    [refresh],
  );

  const openOptions = () => chrome.runtime.openOptionsPage();

  const openHistoryPage = () => {
    const url = chrome.runtime.getURL('src/options/index.html#history');
    void chrome.tabs.create({ url });
  };

  const restore = (index: number) =>
    runAction(`restore:${index}`, async () => {
      await sendMessage({ kind: 'restoreAt', index });
      return 'タブを復元しました';
    });

  return (
    <div className="w-[360px] min-h-[440px] bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h1 className="font-semibold">Tab Tidy</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="更新" onClick={() => void refresh()}>
            <RotateCw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="設定" onClick={openOptions}>
            <Cog className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-4 flex-1">
        {loading ? (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <>
            <Card className="p-3 grid grid-cols-3 gap-2 text-center">
              <Stat
                label="タブ数"
                value={stats?.totalTabs ?? 0}
                hint="このブラウザで開いているタブの総数"
              />
              <Stat
                label="クローズ候補"
                value={stats?.closeCandidates ?? 0}
                hint="クローズ閾値を超えていて「今すぐ閉じる」の対象になるタブ数"
              />
              <Stat
                label="サスペンド済"
                value={stats?.suspendedCount ?? 0}
                hint="メモリ解放済み (chrome.tabs.discard 済み) のタブ数"
              />
            </Card>

            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                クイックアクション
              </h2>
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  disabled={pending !== null}
                  onClick={() =>
                    void runAction('closeInactive', async () => {
                      const candidates = stats?.closeCandidates ?? 0;
                      if (candidates === 0) return 'クローズ閾値を超えたタブはありません';
                      if (
                        !window.confirm(
                          `クローズ閾値を超えた ${candidates} 個のタブを閉じます。よろしいですか？`,
                        )
                      ) {
                        return 'キャンセルしました';
                      }
                      const r = await sendMessage({ kind: 'closeInactiveNow' });
                      return `${r.closed} 個のタブを閉じました`;
                    })
                  }
                >
                  <Trash2 className="w-4 h-4" />
                  クローズ閾値超のタブを閉じる
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending !== null}
                  onClick={() =>
                    void runAction('closeDuplicates', async () => {
                      const groups = await sendMessage({ kind: 'findDuplicates' });
                      const total = groups.reduce((acc, g) => acc + g.tabs.length - 1, 0);
                      if (total === 0) return '重複タブは見つかりませんでした';
                      if (!window.confirm(`${total} 個の重複タブを閉じます。よろしいですか？`)) {
                        return 'キャンセルしました';
                      }
                      const r = await sendMessage({ kind: 'closeDuplicates' });
                      return `${r.closed} 個の重複タブを閉じました`;
                    })
                  }
                >
                  <Copy className="w-4 h-4" />
                  重複タブを閉じる
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending !== null}
                  onClick={() =>
                    void runAction('suspendAll', async () => {
                      const r = await sendMessage({ kind: 'suspendAll' });
                      return r.suspended === 0
                        ? 'サスペンド対象のタブがありません'
                        : `${r.suspended} 個のタブをサスペンドしました`;
                    })
                  }
                >
                  <Moon className="w-4 h-4" />
                  全タブをサスペンド
                </Button>
              </div>
            </section>

            {message && <Card className="px-3 py-2 text-sm text-muted-foreground">{message}</Card>}

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  最近閉じたタブ
                </h2>
                <Button variant="ghost" size="sm" onClick={openHistoryPage}>
                  すべて
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
              <Separator />
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  自動クローズされたタブがここに表示されます。
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {history.slice(0, 5).map((item, idx) => (
                    <li key={`${item.url}-${item.closedAt}`}>
                      <button
                        type="button"
                        className="w-full text-left flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed"
                        onClick={() => void restore(idx)}
                        disabled={pending !== null}
                        aria-label={`${item.title || item.url} を復元`}
                      >
                        {item.favIconUrl ? (
                          <img src={item.favIconUrl} className="w-4 h-4" alt="" />
                        ) : (
                          <div className="w-4 h-4 rounded-sm bg-muted" />
                        )}
                        <span className="flex-1 truncate text-sm">{item.title || item.url}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {relativeFromNow(item.closedAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div title={hint}>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
