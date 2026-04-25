import { useCallback, useEffect, useState } from 'react';
import { Clock, RotateCw, Trash2, X } from 'lucide-react';
import dayjs from 'dayjs';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import type { SnoozedTab } from '@/shared/schema/snooze';
import { sendMessage } from '@/shared/lib/runtime-client';
import { relativeFromNow } from '@/shared/utils/time';

interface State {
  items: SnoozedTab[];
  loading: boolean;
  error: string | null;
}

export function Snoozed() {
  const [state, setState] = useState<State>({ items: [], loading: true, error: null });

  const refresh = useCallback(async () => {
    try {
      const items = await sendMessage({ kind: 'listSnoozed' });
      const sorted = [...items].sort((a, b) => a.wakeAt - b.wakeAt);
      setState({ items: sorted, loading: false, error: null });
    } catch (e) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cancel = async (id: string) => {
    if (!window.confirm('Snooze を取り消してこのエントリを削除しますか？')) return;
    await sendMessage({ kind: 'cancelSnooze', id });
    await refresh();
  };

  const wake = async (id: string) => {
    await sendMessage({ kind: 'wakeSnoozeNow', id });
    await refresh();
  };

  const { items, loading, error } = state;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold mb-1">Snooze</h2>
        <p className="text-sm text-muted-foreground">
          一旦閉じて、指定時刻に自動で再オープンするタブの一覧。Popup から現在のタブを Snooze
          できます。
        </p>
      </header>
      <Card className="p-5 space-y-4">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RotateCw className="w-4 h-4" />
            更新
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Snooze 中のタブはありません。</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3">
                {item.favIconUrl ? (
                  <img src={item.favIconUrl} className="w-4 h-4 shrink-0" alt="" />
                ) : (
                  <div className="w-4 h-4 rounded-sm bg-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.title || item.url}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.url}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {dayjs(item.wakeAt).format('YYYY-MM-DD HH:mm')} に再オープン (
                    {relativeFromNow(item.wakeAt)})
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void wake(item.id)}>
                  <Trash2 className="w-3 h-3" />
                  今すぐ開く
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void cancel(item.id)}
                  aria-label="Snooze を取り消し"
                >
                  <X className="w-3 h-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
