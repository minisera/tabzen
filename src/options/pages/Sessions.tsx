import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Pencil, Plus, RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import type { TabSession } from '@/shared/schema/session';
import { sendMessage } from '@/shared/lib/runtime-client';
import { relativeFromNow } from '@/shared/utils/time';

interface State {
  items: TabSession[];
  loading: boolean;
  error: string | null;
}

export function Sessions() {
  const [state, setState] = useState<State>({ items: [], loading: true, error: null });
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const items = await sendMessage({ kind: 'listSessions' });
      setState({ items, loading: false, error: null });
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

  const save = async (scope: 'currentWindow' | 'allWindows') => {
    const name = newName.trim() || `Session ${new Date().toLocaleString('ja-JP')}`;
    await sendMessage({ kind: 'saveSession', name, scope });
    setNewName('');
    await refresh();
  };

  const open = async (id: string, mode: 'newWindow' | 'currentWindow') => {
    await sendMessage({ kind: 'openSession', id, mode });
  };

  const remove = async (id: string) => {
    if (!window.confirm('このセッションを削除しますか？')) return;
    await sendMessage({ kind: 'deleteSession', id });
    await refresh();
  };

  const commitRename = async () => {
    if (!renaming) return;
    const v = renaming.value.trim();
    if (v) {
      await sendMessage({ kind: 'renameSession', id: renaming.id, name: v });
    }
    setRenaming(null);
    await refresh();
  };

  const { items, loading, error } = state;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold mb-1">セッション</h2>
        <p className="text-sm text-muted-foreground">
          現在のタブ群を「セッション」として保存し、後でまとめて開き直せます。auto-close
          で消えても安心。
        </p>
      </header>

      <Card className="p-5 space-y-3">
        <Label htmlFor="newSessionName">新規セッション</Label>
        <div className="flex gap-2">
          <Input
            id="newSessionName"
            placeholder="名前 (空ならタイムスタンプ)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button onClick={() => void save('currentWindow')}>
            <Plus className="w-4 h-4" />
            このウィンドウを保存
          </Button>
          <Button variant="outline" onClick={() => void save('allWindows')}>
            全ウィンドウを保存
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          chrome:// などの内部 URL は保存対象外です。ピン留めは復元時に再適用されます。
        </p>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">保存済み</h3>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RotateCw className="w-4 h-4" />
            更新
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">保存されたセッションはありません。</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((s) => (
              <li key={s.id} className="py-3 space-y-2">
                <div className="flex items-center gap-2">
                  {renaming?.id === s.id ? (
                    <>
                      <Input
                        value={renaming.value}
                        autoFocus
                        onChange={(e) =>
                          setRenaming((r) => (r ? { ...r, value: e.target.value } : r))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void commitRename();
                          if (e.key === 'Escape') setRenaming(null);
                        }}
                      />
                      <Button size="sm" onClick={() => void commitRename()}>
                        OK
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setRenaming(null)}>
                        キャンセル
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium flex-1 min-w-0 truncate">{s.name}</p>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {s.items.length} タブ · {relativeFromNow(s.createdAt)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRenaming({ id: s.id, value: s.name })}
                        aria-label="名前を変更"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void remove(s.id)}
                        aria-label="削除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => void open(s.id, 'newWindow')}>
                    <ExternalLink className="w-3 h-3" />
                    新規ウィンドウで開く
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void open(s.id, 'currentWindow')}
                  >
                    現在のウィンドウに追加
                  </Button>
                </div>
                {s.items.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5 mt-1">
                    {s.items.slice(0, 12).map((item, idx) => (
                      <li
                        key={`${s.id}-${idx}`}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/60 text-xs max-w-[260px]"
                        title={item.url}
                      >
                        {item.favIconUrl ? (
                          <img src={item.favIconUrl} className="w-3 h-3 shrink-0" alt="" />
                        ) : (
                          <div className="w-3 h-3 rounded-sm bg-muted shrink-0" />
                        )}
                        <span className="truncate">{item.title || item.url}</span>
                      </li>
                    ))}
                    {s.items.length > 12 && (
                      <li className="text-xs text-muted-foreground self-center">
                        +{s.items.length - 12} 件
                      </li>
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
