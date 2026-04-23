import { useCallback, useEffect, useState } from 'react';
import { RotateCw, Trash } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import type { ClosedTab } from '@/shared/schema/tab-meta';
import { sendMessage } from '@/shared/lib/runtime-client';
import { relativeFromNow } from '@/shared/utils/time';

interface HistoryData {
  items: ClosedTab[];
  loading: boolean;
  error: string | null;
}

async function fetchHistory(): Promise<ClosedTab[]> {
  return sendMessage({ kind: 'listHistory' });
}

export function History() {
  const [data, setData] = useState<HistoryData>({
    items: [],
    loading: true,
    error: null,
  });
  const [q, setQ] = useState('');

  const refresh = useCallback(async () => {
    try {
      const items = await fetchHistory();
      setData({ items, loading: false, error: null });
    } catch (e) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const { items, loading, error } = data;

  const filtered = items.filter((i) => {
    if (!q) return true;
    const ql = q.toLowerCase();
    return i.title.toLowerCase().includes(ql) || i.url.toLowerCase().includes(ql);
  });

  const clearAll = async () => {
    if (!window.confirm('履歴をすべて削除しますか？')) return;
    await sendMessage({ kind: 'clearHistory' });
    await refresh();
  };

  const restore = async (item: ClosedTab) => {
    const index = items.indexOf(item);
    if (index < 0) return;
    await sendMessage({ kind: 'restoreAt', index });
    await refresh();
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold mb-1">復元履歴</h2>
        <p className="text-sm text-muted-foreground">
          自動クローズされたタブはここから復元できます。ブラウザを再起動しても残ります。
        </p>
      </header>
      <Card className="p-5 space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="タイトル / URL で検索..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button variant="outline" onClick={() => void refresh()} aria-label="再読み込み">
            <RotateCw className="w-4 h-4" />
          </Button>
          <Button variant="destructive" onClick={() => void clearAll()}>
            <Trash className="w-4 h-4" />
            クリア
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {items.length === 0 ? '履歴はありません。' : '検索結果が見つかりませんでした。'}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {filtered.map((item) => (
              <li key={`${item.url}-${item.closedAt}`} className="flex items-center gap-3 py-2">
                {item.favIconUrl ? (
                  <img src={item.favIconUrl} className="w-4 h-4 shrink-0" alt="" />
                ) : (
                  <div className="w-4 h-4 rounded-sm bg-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.title || item.url}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.url}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {relativeFromNow(item.closedAt)}
                </span>
                <Button variant="ghost" size="sm" onClick={() => void restore(item)}>
                  復元
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
