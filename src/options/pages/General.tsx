import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';
import { Switch } from '@/shared/components/ui/switch';
import { sendMessage } from '@/shared/lib/runtime-client';
import { useSettingsStore } from '@/shared/stores/settings-store';

const PRESETS = [
  { label: '15分', suspend: 10, close: 15 },
  { label: '30分', suspend: 20, close: 30 },
  { label: '1時間', suspend: 30, close: 60 },
  { label: '3時間', suspend: 60, close: 180 },
  { label: '6時間', suspend: 120, close: 360 },
  { label: '12時間', suspend: 180, close: 720 },
];

function isDirty<T>(a: T, b: T): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

function bytesToLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

interface ThumbCacheSectionProps {
  trigger: number;
  onCleared: () => void;
}

interface ThumbCacheState {
  stats: { count: number; approximateBytes: number } | null;
  clearing: boolean;
  error: string | null;
}

async function fetchThumbStats(): Promise<{ count: number; approximateBytes: number }> {
  return sendMessage({ kind: 'getThumbnailStats' });
}

function ThumbCacheSection({ trigger, onCleared }: ThumbCacheSectionProps) {
  const [state, setState] = useState<ThumbCacheState>({
    stats: null,
    clearing: false,
    error: null,
  });

  const load = useCallback(async () => {
    try {
      const stats = await fetchThumbStats();
      setState((prev) => ({ ...prev, stats, error: null }));
    } catch (e) {
      setState((prev) => ({ ...prev, error: e instanceof Error ? e.message : String(e) }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, trigger]);

  const onClear = async () => {
    if (!window.confirm('サムネイルキャッシュをすべて削除しますか？')) return;
    setState((prev) => ({ ...prev, clearing: true }));
    try {
      await sendMessage({ kind: 'clearThumbnails' });
      const stats = await fetchThumbStats();
      setState({ stats, clearing: false, error: null });
      onCleared();
    } catch (e) {
      setState((prev) => ({
        ...prev,
        clearing: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  };

  const { stats, clearing, error } = state;

  return (
    <div>
      <Label>サムネイルキャッシュ</Label>
      <p className="text-xs text-muted-foreground mt-1">
        Alt+Q のオーバーレイで各タブの「最後にアクティブだった時の画面」を表示するためのキャッシュ。
        上限 100 件、7 日経過で自動削除されます。
      </p>
      <div className="flex items-center gap-3 mt-3">
        <span className="text-sm text-muted-foreground tabular-nums">
          {stats ? `${stats.count} 件 / ${bytesToLabel(stats.approximateBytes)}` : '…'}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void onClear()}
          disabled={clearing || (stats?.count ?? 0) === 0}
        >
          {clearing ? 'クリア中…' : 'キャッシュをクリア'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          再読み込み
        </Button>
      </div>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </div>
  );
}

export function General() {
  const { draft, settings, setDraft, save, reset, saving, loading, error } = useSettingsStore();
  const [thumbTrigger, setThumbTrigger] = useState(0);
  if (loading) return <p className="text-sm text-muted-foreground">読み込み中...</p>;
  const dirty = isDirty(settings, draft);
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold mb-1">一般</h2>
        <p className="text-sm text-muted-foreground">
          自動クローズ・サスペンドの挙動と閾値を設定します。
        </p>
      </header>
      <Card className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="enabled">自動処理を有効化</Label>
            <p className="text-xs text-muted-foreground mt-1">
              無効にすると自動クローズ・サスペンドは行われません。
            </p>
          </div>
          <Switch id="enabled" checked={draft.enabled} onChange={(v) => setDraft({ enabled: v })} />
        </div>

        <hr className="border-border" />

        <div>
          <Label>プリセット</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft({ suspendAfterMinutes: p.suspend, closeAfterMinutes: p.close })
                }
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="suspendMin">サスペンド閾値</Label>
            <span className="text-sm tabular-nums">{draft.suspendAfterMinutes} 分</span>
          </div>
          <Slider
            id="suspendMin"
            min={1}
            max={1440}
            value={draft.suspendAfterMinutes}
            onChange={(e) => setDraft({ suspendAfterMinutes: Number(e.target.value) })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="closeMin">クローズ閾値</Label>
            <span className="text-sm tabular-nums">{draft.closeAfterMinutes} 分</span>
          </div>
          <Slider
            id="closeMin"
            min={2}
            max={30 * 24 * 60}
            value={draft.closeAfterMinutes}
            onChange={(e) => setDraft({ closeAfterMinutes: Number(e.target.value) })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="restoreLimit">復元履歴の保持件数</Label>
          <Input
            id="restoreLimit"
            type="number"
            min={10}
            max={1000}
            value={draft.restoreHistoryLimit}
            onChange={(e) => setDraft({ restoreHistoryLimit: Number(e.target.value) || 0 })}
            className="w-32"
          />
        </div>

        <hr className="border-border" />

        <ThumbCacheSection trigger={thumbTrigger} onCleared={() => setThumbTrigger((n) => n + 1)} />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-2 justify-end">
          {dirty && (
            <Button variant="ghost" onClick={reset} disabled={saving}>
              取り消し
            </Button>
          )}
          <Button onClick={() => void save()} disabled={!dirty || saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
