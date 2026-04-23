import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';
import { Switch } from '@/shared/components/ui/switch';
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

export function General() {
  const { draft, settings, setDraft, save, reset, saving, loading, error } = useSettingsStore();
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
